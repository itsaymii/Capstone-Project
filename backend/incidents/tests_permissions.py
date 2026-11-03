"""
Who may read and change reports, volunteers and accounts (security findings 1, 2, 4 and 5).

    python manage.py test incidents.tests_permissions
"""

from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import AccountProfile, OneTimePassword, ensure_account_profile
from incidents.models import AccomplishmentReport, IncidentReport, VictimDetail

REPORTS_URL = '/api/incidents/incident-reports/'


def rows(response):
    """The list rows, whether or not the endpoint is paginated."""
    return response.data['results'] if isinstance(response.data, dict) else response.data


def make_report(**fields):
    values = {
        'time_occurred': '08:00', 'incident_type': 'Fire Incident', 'responder_team': 'Alpha',
        'location': 'Barangay 1', 'latitude': Decimal('13.938781'), 'longitude': Decimal('121.610186'),
        'description': 'Fire near the market', 'action_taken': 'Assisted', 'status': 'Pending',
    }
    values.update(fields)
    return IncidentReport.objects.create(**values)


class AccessTestCase(TestCase):
    def setUp(self):
        cache.clear()  # login/OTP throttles count per IP in the cache
        self.admin = User.objects.create_superuser('boss', 'boss@test.local', 'Pass12345')
        self.responder = User.objects.create_user('resp', 'resp@test.local', 'Pass12345', is_staff=True)
        profile = ensure_account_profile(self.responder)
        profile.role = AccountProfile.ROLE_STAFF
        profile.team = 'Alpha'
        profile.save()
        self.citizen = User.objects.create_user('cit', 'cit@test.local', 'Pass12345')
        ensure_account_profile(self.citizen)

    def client_for(self, user=None):
        client = APIClient()
        if user is not None:
            client.force_authenticate(user)
        return client


class IncidentReportAccessTests(AccessTestCase):
    def setUp(self):
        super().setUp()
        self.report = make_report()

    def test_anonymous_and_citizens_cannot_read_reports(self):
        self.assertEqual(self.client_for().get(REPORTS_URL).status_code, 403)
        self.assertEqual(self.client_for(self.citizen).get(REPORTS_URL).status_code, 403)
        self.assertEqual(self.client_for().get('/api/incidents/accomplishment-reports/').status_code, 403)

    def test_anonymous_and_citizens_cannot_change_reports(self):
        url = f'{REPORTS_URL}{self.report.id}/'
        for client in (self.client_for(), self.client_for(self.citizen)):
            self.assertEqual(client.patch(url, {'status': 'approved'}, format='json').status_code, 403)
            self.assertEqual(client.delete(url).status_code, 403)
        self.assertTrue(IncidentReport.objects.filter(id=self.report.id, status='Pending').exists())

    def test_responder_can_read_but_not_approve_or_delete(self):
        client = self.client_for(self.responder)
        url = f'{REPORTS_URL}{self.report.id}/'
        self.assertEqual(client.get(REPORTS_URL).status_code, 200)
        self.assertEqual(client.patch(url, {'status': 'approved'}, format='json').status_code, 403)
        self.assertEqual(client.delete(url).status_code, 403)

    def test_responder_cannot_file_an_already_approved_report(self):
        response = self.client_for(self.responder).post(REPORTS_URL, {
            'timeOccurred': '14:30', 'incidentType': 'Stand-by Medical Team', 'location': 'Perez Park',
            'latitude': 13.9339, 'longitude': 121.6172, 'description': 'Event', 'actionTaken': 'Stand-by',
            'status': 'Approved', 'victims': [],
            'details': {'event_name': 'Fun Run', 'venue': 'Perez Park', 'persons_assisted': 0},
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(IncidentReport.objects.get(id=response.data['id']).status, 'Pending')
        report = IncidentReport.objects.get(id=response.data['id'])
        self.assertEqual(report.responder_team_record.code, 'alpha')
        self.assertEqual(response.data['responderTeam'], 'Team Alpha')

    def test_responder_without_team_assignment_cannot_file_report(self):
        unassigned = User.objects.create_user('unassigned', 'unassigned@test.local', 'Pass12345', is_staff=True)
        response = self.client_for(unassigned).post(REPORTS_URL, {
            'timeOccurred': '14:30', 'incidentType': 'Stand-by Medical Team', 'location': 'Perez Park',
            'latitude': 13.9339, 'longitude': 121.6172, 'description': 'Event', 'actionTaken': 'Stand-by',
            'victims': [],
            'details': {'event_name': 'Fun Run', 'venue': 'Perez Park', 'persons_assisted': 0},
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('responderTeam', response.data)

    def test_admin_can_approve_and_delete(self):
        client = self.client_for(self.admin)
        url = f'{REPORTS_URL}{self.report.id}/'
        response = client.patch(
            url, {'status': 'approved', 'latitude': 13.938781, 'longitude': 121.610186}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(client.delete(url).status_code, 204)

    def test_public_list_has_only_approved_reports_without_personal_data(self):
        approved = make_report(status='approved', description='Victim Juan, 40, of Purok 2')
        response = self.client_for().get(f'{REPORTS_URL}public/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in response.data], [str(approved.id)])
        for field in ('victims', 'description', 'actionTaken', 'details', 'createdBy'):
            self.assertNotIn(field, response.data[0])


class PersonalDataAccessTests(AccessTestCase):
    def test_responder_reports_need_a_dashboard_account(self):
        url = '/api/incidents/responder-reports/'
        self.assertEqual(self.client_for().get(url).status_code, 403)
        self.assertEqual(self.client_for(self.citizen).get(url).status_code, 403)
        self.assertEqual(self.client_for(self.responder).get(url).status_code, 200)

    def test_volunteers_are_admin_only(self):
        url = '/api/resources/volunteers/'
        for user in (None, self.citizen, self.responder):
            self.assertEqual(self.client_for(user).get(url).status_code, 403, user)
        self.assertEqual(self.client_for(self.admin).get(url).status_code, 200)


class AdminDataTests(AccessTestCase):
    """Barangays, evacuation centers, supplies, hazard types and incidents: anyone reads, only admins change."""

    def setUp(self):
        super().setUp()
        from locations.models import Barangay
        from resources.models import EvacuationCenter
        self.barangay = Barangay.objects.create(name='Cotta', population=1000)
        self.center = EvacuationCenter.objects.create(
            name='Cotta Covered Court', latitude=Decimal('13.92'), longitude=Decimal('121.60'), address='Cotta',
        )

    def test_public_pages_can_still_read(self):
        for url in ('/api/locations/barangays/', '/api/resources/evacuation-centers/', '/api/incidents/hazard-types/'):
            self.assertEqual(self.client_for().get(url).status_code, 200, url)

    def test_responders_and_citizens_cannot_change_admin_data(self):
        for user in (self.responder, self.citizen):
            client = self.client_for(user)
            self.assertEqual(client.patch(f'/api/locations/barangays/{self.barangay.id}/', {'population': 1}, format='json').status_code, 403)
            self.assertEqual(client.delete(f'/api/resources/evacuation-centers/{self.center.id}/').status_code, 403)
            self.assertEqual(client.post('/api/resources/supply-categories/', {'name': 'Food'}, format='json').status_code, 403)
            self.assertEqual(client.post('/api/incidents/hazard-types/', {'name': 'Fake'}, format='json').status_code, 403)
        self.barangay.refresh_from_db()
        self.assertEqual(self.barangay.population, 1000)
        self.assertTrue(type(self.center).objects.filter(pk=self.center.pk).exists())

    def test_admin_can_change_admin_data(self):
        client = self.client_for(self.admin)
        self.assertEqual(client.patch(f'/api/locations/barangays/{self.barangay.id}/', {'population': 1200}, format='json').status_code, 200)
        self.assertEqual(client.post('/api/resources/supply-categories/', {'name': 'Food'}, format='json').status_code, 201)
        self.assertEqual(client.delete(f'/api/resources/evacuation-centers/{self.center.id}/').status_code, 204)


class AccountManagementAccessTests(AccessTestCase):
    def test_responder_cannot_manage_accounts(self):
        client = self.client_for(self.responder)
        self.assertEqual(client.get('/dashboard/admin/accounts/').status_code, 403)

        promote = client.put(f'/dashboard/admin/accounts/{self.responder.id}/', {
            'fullName': 'Resp', 'email': 'resp@test.local', 'username': 'resp', 'role': 'admin',
        }, format='json')
        self.assertEqual(promote.status_code, 403)
        self.assertEqual(AccountProfile.objects.get(user=self.responder).role, AccountProfile.ROLE_STAFF)

        self.assertEqual(client.delete(f'/dashboard/admin/accounts/{self.admin.id}/').status_code, 403)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())

    def test_admin_can_list_accounts(self):
        self.assertEqual(self.client_for(self.admin).get('/dashboard/admin/accounts/').status_code, 200)


class OneAccountPerBrowserTests(AccessTestCase):
    LOGIN_URL = '/accounts/auth/login/'

    def login(self, client, email, **extra):
        return client.post(self.LOGIN_URL, {'email': email, 'password': 'Pass12345', **extra}, content_type='application/json')

    def test_another_account_cannot_log_in_until_the_first_logs_out(self):
        browser = self.client  # one Django test client = one browser with one session cookie
        self.assertEqual(self.login(browser, 'boss@test.local').status_code, 200)

        for email in ('cit@test.local', 'resp@test.local'):
            response = self.login(browser, email)
            self.assertEqual(response.status_code, 409, email)
            self.assertEqual(response.json()['code'], 'another_account_logged_in')

        # The same account may log in again, and after logging out anyone may.
        self.assertEqual(self.login(browser, 'boss@test.local').status_code, 200)
        browser.post('/accounts/auth/logout/')
        self.assertEqual(self.login(browser, 'resp@test.local').status_code, 200)

    def test_otp_step_also_refuses_a_second_account(self):
        browser = self.client
        self.login(browser, 'boss@test.local')
        OneTimePassword.objects.create(
            email='cit@test.local', purpose=OneTimePassword.PURPOSE_LOGIN, code_hash=make_password('123456'),
            payload={'userId': self.citizen.id}, expires_at=timezone.now() + timezone.timedelta(minutes=3),
        )
        response = browser.post(
            '/accounts/auth/login/verify-otp/', {'email': 'cit@test.local', 'otp': '123456'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 409)

    def test_session_ends_with_the_browser_unless_keep_logged_in(self):
        self.login(self.client, 'boss@test.local')
        self.assertTrue(self.client.session.get_expire_at_browser_close())

        browser = self.client_class()
        self.login(browser, 'boss@test.local', keepLoggedIn=True)
        self.assertFalse(browser.session.get_expire_at_browser_close())


class OtpAttemptTests(AccessTestCase):
    URL = '/accounts/auth/login/verify-otp/'

    def setUp(self):
        super().setUp()
        self.otp = OneTimePassword.objects.create(
            email='cit@test.local', purpose=OneTimePassword.PURPOSE_LOGIN, code_hash=make_password('123456'),
            payload={'userId': self.citizen.id}, expires_at=timezone.now() + timezone.timedelta(minutes=3),
        )

    def test_otp_stops_working_after_five_wrong_codes(self):
        client = self.client_for()
        for _ in range(5):
            response = client.post(self.URL, {'email': 'cit@test.local', 'otp': '000000'}, format='json')
            self.assertEqual(response.status_code, 400)

        # The right code no longer works: the user must request a new OTP.
        response = client.post(self.URL, {'email': 'cit@test.local', 'otp': '123456'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.otp.refresh_from_db()
        self.assertTrue(self.otp.is_used)

    def test_right_code_works_after_a_few_mistakes(self):
        client = self.client_for()
        for _ in range(2):
            client.post(self.URL, {'email': 'cit@test.local', 'otp': '000000'}, format='json')
        response = client.post(self.URL, {'email': 'cit@test.local', 'otp': '123456'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def test_login_attempts_are_throttled(self):
        client = self.client_for()
        codes = [
            client.post('/accounts/auth/login/', {'email': 'cit@test.local', 'password': 'wrong'}, format='json').status_code
            for _ in range(11)
        ]
        self.assertEqual(codes[:10], [401] * 10)
        self.assertEqual(codes[10], 429)


class OtherTeamVictimTests(AccessTestCase):
    """Responders see other teams' reports, but not the people in them."""

    def setUp(self):
        super().setUp()  # self.responder is on team Alpha
        self.own = make_report(responder_team='Alpha', description='Juan, 40, burned hand', action_taken='Brought Juan to QMC')
        self.other = make_report(responder_team='Bravo', description='Maria, 25, fainted', action_taken='Treated Maria on site')
        for report in (self.own, self.other):
            VictimDetail.objects.create(incident_report=report, name='Someone', age='30', gender='F', address='Purok 1', condition='Stable')

    def report_from(self, client, report):
        response = client.get(REPORTS_URL)
        self.assertEqual(response.status_code, 200)
        return next(item for item in rows(response) if item['id'] == str(report.id))

    def test_responder_sees_own_team_victims_only(self):
        client = self.client_for(self.responder)
        own = self.report_from(client, self.own)
        self.assertEqual(len(own['victims']), 1)
        self.assertEqual(own['description'], 'Juan, 40, burned hand')
        self.assertFalse(own['personalDataHidden'])

        other = self.report_from(client, self.other)
        self.assertEqual(other['victims'], [])
        self.assertEqual(other['description'], '')
        self.assertEqual(other['actionTaken'], '')
        self.assertTrue(other['personalDataHidden'])
        # What happened, where and when stays visible for coordination.
        self.assertEqual((other['incidentType'], other['location'], other['victimCount']), ('Fire Incident', 'Barangay 1', 0))

    def test_single_report_is_hidden_too(self):
        response = self.client_for(self.responder).get(f'{REPORTS_URL}{self.other.id}/')
        self.assertEqual(response.data['victims'], [])
        self.assertTrue(response.data['personalDataHidden'])

    def test_reports_inside_accomplishment_reports_are_hidden_too(self):
        compiled = AccomplishmentReport.objects.create(title='October', compiled_by=self.responder)
        compiled.incident_reports.set([self.own, self.other])
        response = self.client_for(self.responder).get('/api/incidents/accomplishment-reports/')
        nested = {item['id']: item for item in rows(response)[0]['reports']}
        self.assertEqual(len(nested[str(self.own.id)]['victims']), 1)
        self.assertEqual(nested[str(self.other.id)]['victims'], [])

    def test_responder_without_a_team_sees_no_victims(self):
        AccountProfile.objects.filter(user=self.responder).update(team='')
        client = self.client_for(User.objects.get(pk=self.responder.pk))
        self.assertTrue(self.report_from(client, self.own)['personalDataHidden'])

    def test_admin_sees_every_victim(self):
        client = self.client_for(self.admin)
        for report in (self.own, self.other):
            data = self.report_from(client, report)
            self.assertEqual(len(data['victims']), 1)
            self.assertFalse(data['personalDataHidden'])


class ResidencyProofAccessTests(AccessTestCase):
    """Residency proof images (IDs, bills) are only for admins, never a public /media/ link."""

    PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 32

    def setUp(self):
        super().setUp()
        import tempfile

        from django.core.files.base import ContentFile
        from django.test import override_settings

        from accounts.models import ResidencyVerification

        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        settings_override = override_settings(MEDIA_ROOT=media.name)
        settings_override.enable()
        self.addCleanup(settings_override.disable)

        self.verification = ResidencyVerification(
            user=self.citizen, email='cit@test.local', barangay_name='Cotta', residential_address='Purok 1',
            proof_document_name='juan-id.png',
        )
        self.verification.proof_document.save('juan-id.png', ContentFile(self.PNG), save=True)
        self.url = f'/dashboard/admin/accounts/{self.citizen.id}/residency-proof/'

    def test_admin_gets_the_image(self):
        response = self.client_for(self.admin).get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b''.join(response.streaming_content), self.PNG)
        self.assertEqual(response['Content-Type'], 'image/png')
        self.assertEqual(response['Cache-Control'], 'private, no-store')

    def test_others_cannot_get_the_image(self):
        for user in (None, self.citizen, self.responder):
            self.assertEqual(self.client_for(user).get(self.url).status_code, 403, user)

    def test_account_list_links_to_the_admin_endpoint(self):
        users = self.client_for(self.admin).get('/dashboard/admin/accounts/').json()['users']
        citizen = next(user for user in users if user['id'] == self.citizen.id)
        self.assertEqual(citizen['residencyProofUrl'], self.url)

    def test_media_link_is_blocked(self):
        from django.http import Http404
        from django.test import RequestFactory

        from config.urls import serve_public_media

        request = RequestFactory().get('/media/')
        stored = self.verification.proof_document.name  # residency_verification_documents/juan-id....png
        for path in (stored, f'other/../{stored}', stored.upper(), f'./{stored}'):
            with self.assertRaises(Http404, msg=path):
                serve_public_media(request, path)


class IncidentListAccessTests(AccessTestCase):
    """Incidents carry the reporter's username and free text that can name victims: admins only."""

    def setUp(self):
        super().setUp()
        from incidents.models import HazardType, Incident

        self.incident = Incident.objects.create(
            hazard_type=HazardType.objects.create(name='Fire'), latitude=Decimal('13.93'), longitude=Decimal('121.61'),
            address='Barangay 1', incident_datetime=timezone.now(), severity_level='high', status='verified',
            description='Victim Juan, 40, burned hand', reported_by=self.responder,
        )

    def test_only_admins_can_read_incidents(self):
        urls = (
            '/api/incidents/incidents/',
            f'/api/incidents/incidents/{self.incident.id}/',
            f'/api/incidents/incidents/lookup/{self.incident.reference_code}/',
        )
        for url in urls:
            for user in (None, self.citizen, self.responder):
                self.assertEqual(self.client_for(user).get(url).status_code, 403, (url, user))
            self.assertEqual(self.client_for(self.admin).get(url).status_code, 200, url)

    def test_public_pages_still_get_approved_reports(self):
        make_report(status='approved')
        self.assertEqual(self.client_for().get(f'{REPORTS_URL}public/').status_code, 200)
