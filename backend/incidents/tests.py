from django.test import TestCase
from django.utils import timezone

from accounts.models import AccountProfile
from django.contrib.auth.models import User

from incidents.serializers import IncidentReportSerializer


class IncidentReportSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='reporter',
            email='reporter@example.com',
            password='password123',
        )
        self.user.account_profile.role = AccountProfile.ROLE_STAFF
        self.user.account_profile.save(update_fields=['role'])

    def test_create_preserves_explicit_victim_count_when_no_victims(self):
        data = {
            'timeOccurred': timezone.now().time(),
            'incidentType': 'Fire',
            'responderTeam': 'Team A',
            'location': 'Test Barangay',
            'latitude': 13.941,
            'longitude': 121.615,
            'description': 'Major fire incident',
            'victimCount': 5,
            'actionTaken': 'Response dispatched',
            'status': 'Submitted',
        }

        serializer = IncidentReportSerializer(data=data, context={'request': None})
        self.assertTrue(serializer.is_valid(), serializer.errors)

        report = serializer.save()
        self.assertEqual(report.victim_count, 5)
