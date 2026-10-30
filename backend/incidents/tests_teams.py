"""
Team names are Alpha, Bravo and Charlie, never "Team Alpha".

    python manage.py test incidents.tests_teams
"""

from decimal import Decimal
from importlib import import_module
from unittest import TestCase as PlainTestCase

from incidents.teams import team_name


class TeamNameTests(PlainTestCase):
    def test_team_prefix_is_removed(self):
        for raw, expected in [
            ('Team Alpha', 'Alpha'), ('TEAM-bravo', 'Bravo'), ('team: Charlie', 'Charlie'),
            ('  Team   Alpha ', 'Alpha'), ('alpha', 'Alpha'), ('Team Rescue 1', 'Rescue 1'),
        ]:
            self.assertEqual(team_name(raw), expected, raw)

    def test_other_names_are_kept(self):
        for raw in ('John Responder', 'Teamwork Unit', 'Team', ''):
            self.assertEqual(team_name(raw), raw)


try:
    from django.apps import apps as django_apps
    from django.contrib.auth.models import User
    from django.test import TestCase as DjangoTestCase
except ImportError:  # running without Django installed
    DjangoTestCase = None


if DjangoTestCase is not None:
    from rest_framework.test import APIClient

    from incidents.models import IncidentReport

    def make_report(**fields):
        values = {
            'time_occurred': '08:00', 'incident_type': 'Fire Incident', 'responder_team': 'Alpha',
            'location': 'Barangay 1', 'latitude': Decimal('13.938781'), 'longitude': Decimal('121.610186'),
            'description': 'Test', 'action_taken': 'Assisted',
        }
        values.update(fields)
        return IncidentReport.objects.create(**values)

    class TeamNameSavingTests(DjangoTestCase):
        def test_saved_reports_drop_the_team_prefix(self):
            report = make_report(responder_team='Team Bravo')
            report.refresh_from_db()
            self.assertEqual(report.responder_team, 'Bravo')

        def file_report(self, user, **extra):
            client = APIClient()
            client.force_authenticate(user)
            return client.post('/api/incidents/incident-reports/', {
                'timeOccurred': '14:30', 'incidentType': 'Stand-by Medical Team', 'location': 'Perez Park',
                'latitude': 13.9339, 'longitude': 121.6172, 'description': 'Event', 'actionTaken': 'Stand-by',
                'status': 'Pending', 'victims': [],
                'details': {'event_name': 'Fun Run', 'venue': 'Perez Park', 'persons_assisted': 0}, **extra,
            }, format='json')

        def test_report_is_filed_under_the_account_team_not_its_name(self):
            responder = User.objects.create_user('juan', 'juan@test.local', 'Pass12345', is_staff=True, first_name='Juan Dela Cruz')
            responder.account_profile.team = 'Charlie'
            responder.account_profile.save(update_fields=['team'])

            response = self.file_report(responder, responderTeam='Rescue 9')
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data['responderTeam'], 'Charlie')

        def test_responder_without_a_team_cannot_file(self):
            responder = User.objects.create_user('juan', 'juan@test.local', 'Pass12345', is_staff=True, first_name='Juan Dela Cruz')
            response = self.file_report(responder)
            self.assertEqual(response.status_code, 400)
            self.assertIn('no team', str(response.data['responderTeam']))
            self.assertFalse(IncidentReport.objects.exists())

        def test_admin_cannot_file_reports(self):
            admin = User.objects.create_superuser('boss', 'boss@test.local', 'Pass12345')
            self.assertEqual(self.file_report(admin).status_code, 403)

        def test_migration_sets_teams_from_account_names_and_fixes_old_reports(self):
            named = User.objects.create_user('alpha', 'alpha@test.local', 'Pass12345', is_staff=True, first_name='Team Alpha')
            unnamed = User.objects.create_user('juan', 'juan@test.local', 'Pass12345', is_staff=True, first_name='Juan')
            old = make_report(responder_team='Team Alpha', created_by=named)
            IncidentReport.objects.filter(pk=old.pk).update(responder_team='Team Alpha Unit')
            other = make_report(responder_team='Juan', created_by=unnamed)

            import_module('accounts.migrations.0007_accountprofile_team').team_from_account_name(django_apps, None)
            import_module('incidents.migrations.0010_report_team_from_account').team_from_filing_account(django_apps, None)

            named.account_profile.refresh_from_db()
            unnamed.account_profile.refresh_from_db()
            self.assertEqual(named.account_profile.team, 'Alpha')
            self.assertEqual(unnamed.account_profile.team, '')  # an admin sets it in Users
            old.refresh_from_db()
            other.refresh_from_db()
            self.assertEqual(old.responder_team, 'Alpha')
            self.assertEqual(other.responder_team, 'Juan')

        def test_migration_cleans_existing_reports(self):
            report = make_report()
            IncidentReport.objects.filter(pk=report.pk).update(responder_team='Team Charlie')

            migration = import_module('incidents.migrations.0009_team_names_without_prefix')
            migration.remove_team_prefix(django_apps, None)

            report.refresh_from_db()
            self.assertEqual(report.responder_team, 'Charlie')
