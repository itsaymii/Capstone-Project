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
    from django.contrib.auth.models import User
    from django.test import TestCase as DjangoTestCase
except ImportError:  # running without Django installed
    DjangoTestCase = None


if DjangoTestCase is not None:
    from rest_framework.test import APIClient

    from incidents.models import IncidentReport, ResponderTeam

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
                'details': {
                    'event_name': 'Fun Run',
                    'venue': 'Perez Park',
                    'persons_assisted': 0,
                    'triage_acuity': 'none',
                    'resource_utilization': 'on_site',
                }, **extra,
            }, format='json')

        def test_report_is_filed_under_the_account_team_not_its_name(self):
            responder = User.objects.create_user('juan', 'juan@test.local', 'Pass12345', is_staff=True, first_name='Juan Dela Cruz')
            responder.account_profile.responder_team = ResponderTeam.objects.get(code='charlie')
            responder.account_profile.save(update_fields=['responder_team'])

            response = self.file_report(responder, responderTeam='Rescue 9')
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data['responderTeam'], 'Charlie')
            self.assertEqual(
                IncidentReport.objects.get(pk=response.data['id']).responder_team_record.code,
                'charlie',
            )

        def test_responder_without_a_team_cannot_file(self):
            responder = User.objects.create_user('juan', 'juan@test.local', 'Pass12345', is_staff=True, first_name='Juan Dela Cruz')
            response = self.file_report(responder)
            self.assertEqual(response.status_code, 400)
            self.assertIn('no team', str(response.data['responderTeam']))
            self.assertFalse(IncidentReport.objects.exists())

        def test_admin_cannot_file_reports(self):
            admin = User.objects.create_superuser('boss', 'boss@test.local', 'Pass12345')
            self.assertEqual(self.file_report(admin).status_code, 403)

        def test_account_team_migration_normalizes_known_legacy_labels(self):
            migration = import_module('accounts.migrations.0010_remove_accountprofile_team')
            for value, expected in (
                ('Alpha', 'alpha'),
                ('Team Bravo', 'bravo'),
                ('TEAM: Charlie', 'charlie'),
                ('Team Delta', None),
                ('Juan Dela Cruz', None),
            ):
                self.assertEqual(migration.team_code_for_legacy_value(value), expected, value)
