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
from incidents.models import IncidentReport

REPORTS_URL = '/api/incidents/incident-reports/'


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
    def test_volunteers_and_responder_reports_need_a_dashboard_account(self):
        for url in ('/api/resources/volunteers/', '/api/incidents/responder-reports/'):
            self.assertEqual(self.client_for().get(url).status_code, 403, url)
            self.assertEqual(self.client_for(self.citizen).get(url).status_code, 403, url)
            self.assertEqual(self.client_for(self.responder).get(url).status_code, 200, url)


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
