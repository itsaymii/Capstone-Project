from django.test import TestCase
from unittest.mock import patch
from django.contrib.auth.models import User
from django.utils import timezone

from incidents.models import HazardType, Incident, IncidentReport
from accounts.models import AccountProfile, ResidencyVerification
from locations.models import Barangay


class CriticalSmsSignalTests(TestCase):
    def setUp(self):
        self.hazard = HazardType.objects.create(name='Flood', description='Flood hazard')
        self.barangay = Barangay.objects.create(name='Cotta')

        self.citizen_user = User.objects.create_user(
            username='citizen-user',
            email='citizen@example.com',
            password='password123',
        )
        self.citizen_profile = self.citizen_user.account_profile
        self.citizen_profile.role = AccountProfile.ROLE_CITIZEN
        self.citizen_profile.phone_number = '09171234567'
        self.citizen_profile.save(update_fields=['role', 'phone_number'])
        self.residency = ResidencyVerification.objects.create(
            user=self.citizen_user,
            email='citizen@example.com',
            barangay_record=self.barangay,
            residential_address='Cotta, Lucena City',
            proof_document='residency_verification_documents/proof.jpg',
            proof_document_name='proof.jpg',
            status=ResidencyVerification.STATUS_VERIFIED,
        )

        self.staff_user = User.objects.create_user(
            username='staff-user',
            email='staff@example.com',
            password='password123',
        )
        self.staff_profile = self.staff_user.account_profile
        self.staff_profile.role = AccountProfile.ROLE_STAFF
        self.staff_profile.phone_number = '+639181234567'
        self.staff_profile.save(update_fields=['role', 'phone_number'])

    @patch('incidents.signals.send_critical_alert')
    @patch('sms.signals.send_critical_alert')
    def test_critical_incident_triggers_sms_to_citizens_only(
        self,
        mock_citywide_alert,
        mock_barangay_alert,
    ):
        incident = Incident.objects.create(
            hazard_type=self.hazard,
            barangay=self.barangay,
            latitude=13.941,
            longitude=121.615,
            address='Test Street',
            incident_datetime=timezone.now(),
            severity_level='critical',
            description='Critical flood event',
        )

        mock_citywide_alert.assert_called_once()
        _, kwargs = mock_citywide_alert.call_args
        self.assertEqual(kwargs['phone_number'], '09171234567')
        self.assertEqual(kwargs['incident'], incident)
        self.assertIn('CRITICAL FLOOD', kwargs['message'])
        mock_barangay_alert.assert_called_once()
        self.assertEqual(mock_barangay_alert.call_args.args[0], '09171234567')

    @patch('incidents.signals.send_critical_alert')
    @patch('sms.signals.send_critical_alert')
    def test_legacy_text_without_barangay_foreign_key_does_not_match(
        self,
        mock_citywide_alert,
        mock_barangay_alert,
    ):
        ResidencyVerification.objects.filter(pk=self.residency.pk).update(
            barangay_record=None,
            legacy_barangay_name=self.barangay.name,
        )

        Incident.objects.create(
            hazard_type=self.hazard,
            barangay=self.barangay,
            latitude=13.941,
            longitude=121.615,
            address='Test Street',
            incident_datetime=timezone.now(),
            severity_level='critical',
            description='Critical flood event',
        )

        mock_citywide_alert.assert_called_once()
        mock_barangay_alert.assert_not_called()

    @patch('incidents.signals.send_critical_alert')
    @patch('sms.signals.send_critical_alert')
    def test_approved_critical_report_triggers_sms_to_citizens(
        self,
        mock_citywide_alert,
        mock_barangay_alert,
    ):
        IncidentReport.objects.create(
            time_occurred=timezone.now().time(),
            incident_type='Fire',
            responder_team='Team A',
            location='Test Barangay',
            latitude=13.941,
            longitude=121.615,
            description='Major fire with many victims',
            victim_count=5,
            action_taken='Response dispatched',
            status='Approved',
            created_by=self.staff_user,
            barangay=self.barangay,
        )

        mock_citywide_alert.assert_called_once()
        _, kwargs = mock_citywide_alert.call_args
        self.assertEqual(kwargs['phone_number'], '09171234567')
        self.assertIn('CRITICAL FIRE', kwargs['message'])
        mock_barangay_alert.assert_called_once()

    @patch('incidents.signals.send_critical_alert')
    @patch('sms.signals.send_critical_alert')
    def test_non_critical_incident_does_not_trigger_sms(
        self,
        mock_citywide_alert,
        mock_barangay_alert,
    ):
        Incident.objects.create(
            hazard_type=self.hazard,
            latitude=13.941,
            longitude=121.615,
            address='Test Street',
            incident_datetime=timezone.now(),
            severity_level='high',
            description='High severity flood event',
        )

        mock_citywide_alert.assert_not_called()
        mock_barangay_alert.assert_not_called()
