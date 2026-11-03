"""
Tests for type-specific incident report details.

    python manage.py test incidents.tests_incident_details

The first two classes test the plain rules in incidents/incident_types.py.
ReportDetailsApiTests goes through the real API: create a report, then approve it.
"""

from decimal import Decimal
from unittest import TestCase as PlainTestCase

from incidents.incident_types import (
    INCIDENT_TYPES,
    detail_table_values,
    fit_detail_values,
    get_incident_type,
    validate_report_details,
)


class FieldRulesTests(PlainTestCase):
    def test_every_type_has_a_unique_key_and_required_field(self):
        keys = [config['key'] for config in INCIDENT_TYPES.values()]
        self.assertEqual(len(keys), len(set(keys)))
        for label, config in INCIDENT_TYPES.items():
            self.assertTrue(any(spec['required'] for spec in config['fields']), label)

    def test_type_lookup_ignores_case(self):
        self.assertEqual(get_incident_type('fire incident')['key'], 'fire')
        self.assertIsNone(get_incident_type('Earthquake'))

    def test_valid_fire_details_are_cleaned(self):
        cleaned, _, errors = validate_report_details('Fire Incident', {
            'structure_type': 'residential',
            'alarm_level': 'second',
            'structures_affected': '3',
            'estimated_damage': '150000.50',
            'bfp_present': 'true',
            'fire_out_time': '14:05',
            'suspected_cause': '',
        })
        self.assertEqual(errors, {})
        self.assertEqual(cleaned, {
            'structure_type': 'residential',
            'alarm_level': 'second',
            'structures_affected': 3,
            'estimated_damage': 150000.5,
            'bfp_present': True,
            'fire_out_time': '14:05',
        })

    def test_field_from_another_type_is_rejected(self):
        _, _, errors = validate_report_details('Fire Incident', {
            'structure_type': 'residential', 'alarm_level': 'first', 'vehicles_involved': 2,
        })
        self.assertIn('vehicles_involved', errors['details'])

    def test_required_fields_are_enforced(self):
        _, _, errors = validate_report_details('RCA', {'vehicles_involved': 2})
        self.assertIn('vehicle_types', errors['details'])
        self.assertIn('collision_type', errors['details'])

    def test_bad_values_are_rejected(self):
        _, _, errors = validate_report_details('RCA', {
            'vehicles_involved': 0, 'vehicle_types': ['spaceship'], 'collision_type': 'head_on',
        })
        self.assertIn('vehicles_involved', errors['details'])
        self.assertIn('vehicle_types', errors['details'])

    def test_standby_has_no_victims(self):
        details = {'event_name': 'Pasayahan Festival', 'venue': 'Perez Park', 'persons_assisted': 12}
        _, _, errors = validate_report_details('Stand-by Medical Team', details, [{'name': 'X'}])
        self.assertIn('victims', errors)
        _, _, errors = validate_report_details('Stand-by Medical Team', details, [])
        self.assertEqual(errors, {})

    def test_medical_needs_a_patient_and_ambulance_only_one(self):
        medical = {'chief_complaint': 'seizure', 'consciousness': 'alert'}
        self.assertIn('victims', validate_report_details('Medical Emergency', medical, [])[2])
        ambulance = {'pickup_location': 'Brgy 1', 'destination_hospital': 'QMC', 'transport_reason': 'referral'}
        self.assertEqual(validate_report_details('Ambulance Assistance', ambulance, [{}])[2], {})
        self.assertIn('victims', validate_report_details('Ambulance Assistance', ambulance, [{}, {}])[2])

    def test_victim_fields_are_per_type(self):
        details = {'vehicles_involved': 1, 'vehicle_types': ['motorcycle'], 'collision_type': 'self_accident'}
        _, victim_details, errors = validate_report_details('RCA', details, [
            {'details': {'person_role': 'driver', 'protective_gear': 'helmet'}},
        ])
        self.assertEqual(errors, {})
        self.assertEqual(victim_details, [{'person_role': 'driver', 'protective_gear': 'helmet'}])

        _, _, errors = validate_report_details('RCA', details, [{'details': {'pulse_rate': 80}}])
        self.assertIn('victims', errors)

    def test_unknown_type_allows_no_details(self):
        self.assertEqual(validate_report_details('Other', {}, [])[2], {})
        self.assertIn('details', validate_report_details('Other', {'x': 1}, [])[2])


class DetailTableTests(PlainTestCase):
    def test_fire_values(self):
        table, values = detail_table_values('Fire Incident', {
            'suspected_cause': 'electrical', 'structures_affected': 4, 'fatalities': 1, 'estimated_damage': 2500.5,
        }, victim_count=2)
        self.assertEqual(table, 'fire')
        self.assertEqual(values, {
            'cause': 'Electrical', 'damage_estimate': Decimal('2500.50'),
            'casualties': 1, 'injuries': 2, 'structures_affected': 4,
        })

    def test_rca_values(self):
        table, values = detail_table_values('RCA', {
            'vehicles_involved': 2, 'vehicle_types': ['motorcycle', 'jeepney'], 'suspected_cause': 'overspeeding',
        }, victim_count=1)
        self.assertEqual(table, 'vehicular')
        self.assertEqual(values['vehicle_types'], 'Motorcycle, Jeepney')
        self.assertEqual(values['cause'], 'Overspeeding')

    def test_standby_and_ambulance_use_medical_table(self):
        self.assertEqual(detail_table_values('Stand-by Medical Team', {'persons_assisted': 7, 'event_name': 'Fun Run'}, 0),
                         ('medical', {'patient_count': 7, 'emergency_type': 'Stand-by Medical Team: Fun Run',
                                      'transported': 0, 'hospital': ''}))
        table, values = detail_table_values('Ambulance Assistance', {'destination_hospital': 'QMC', 'transport_reason': 'dialysis'}, 1)
        self.assertEqual((table, values['hospital'], values['emergency_type']), ('medical', 'QMC', 'Ambulance Assistance: Dialysis'))

    def test_drowning_counts_rescued(self):
        _, values = detail_table_values('Drowning', {'water_body': 'river', 'rescued_alive': 2, 'revived_cpr': 1, 'fatalities': 1}, 4)
        self.assertEqual(values, {'victims': 4, 'rescued': 3, 'fatalities': 1, 'water_body': 'River'})

    def test_empty_details_still_work(self):
        for label in INCIDENT_TYPES:
            table, values = detail_table_values(label, {}, 0)
            self.assertIsNotNone(table, label)

    def test_long_text_is_trimmed_to_column_size(self):
        values = fit_detail_values('medical', {'emergency_type': 'x' * 150, 'patient_count': 1})
        self.assertEqual(len(values['emergency_type']), 100)


try:
    from django.contrib.auth.models import User
    from django.test import TestCase as DjangoTestCase
    from rest_framework.test import APIClient
except ImportError:  # running without Django installed
    DjangoTestCase = None


if DjangoTestCase is not None:
    from incidents.models import (
        CrimeReport,
        FireDetails,
        Incident,
        IncidentReport,
        MedicalEmergency,
        ResponderTeam,
    )
    from accounts.models import AccountProfile

    REPORTS_URL = '/api/incidents/incident-reports/'

    class ReportDetailsApiTests(DjangoTestCase):
        def setUp(self):
            self.client = APIClient()
            responder = User.objects.create_user('responder_test', 'responder@test.local', 'Pass12345', is_staff=True)
            responder.account_profile.responder_team = ResponderTeam.objects.get(code='alpha')
            responder.account_profile.save(update_fields=['responder_team'])
            self.client.force_authenticate(responder)
            # Responders file reports; only an admin may approve them.
            self.admin_client = APIClient()
            self.admin_client.force_authenticate(
                User.objects.create_superuser('admin_test', 'admin@test.local', 'Pass12345')
            )

        def report(self, incident_type, details=None, victims=None):
            payload = {
                'timeOccurred': '14:30',
                'incidentType': incident_type,
                'responderTeam': 'Alpha',
                'location': 'Market View, Lucena City',
                'latitude': 13.9339,
                'longitude': 121.6172,
                'description': 'Test report',
                'actionTaken': 'Responded on site',
                'status': 'Pending',
                'victims': victims or [],
            }
            if details is not None:
                payload['details'] = details
            return self.client.post(REPORTS_URL, payload, format='json')

        def approve(self, report_id):
            return self.admin_client.patch(
                f'{REPORTS_URL}{report_id}/',
                {'status': 'approved', 'latitude': 13.9339, 'longitude': 121.6172},
                format='json',
            )

        def test_fire_report_saves_details_and_fills_fire_table_on_approval(self):
            response = self.report('Fire Incident', {
                'structure_type': 'residential', 'alarm_level': 'third',
                'suspected_cause': 'electrical', 'structures_affected': 3, 'estimated_damage': 500000,
            }, victims=[{
                'name': 'Juan Dela Cruz', 'age': '40', 'gender': 'M', 'address': 'Market View',
                'condition': 'Minor burns', 'details': {'injury_type': 'burns'},
            }])
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data['details']['alarm_level'], 'third')
            self.assertEqual(response.data['victims'][0]['details'], {'injury_type': 'burns'})

            report = IncidentReport.objects.get(id=response.data['id'])
            self.assertEqual(self.approve(report.id).status_code, 200)

            incident = Incident.objects.get(reference_code=report.incident_code)
            fire = FireDetails.objects.get(incident=incident)
            self.assertEqual((fire.cause, fire.structures_affected, fire.injuries), ('Electrical', 3, 1))
            self.assertEqual(fire.damage_estimate, Decimal('500000.00'))

        def test_field_of_another_type_is_rejected(self):
            response = self.report('Fire Incident', {
                'structure_type': 'residential', 'alarm_level': 'first', 'vehicles_involved': 2,
            })
            self.assertEqual(response.status_code, 400)
            self.assertIn('vehicles_involved', response.data['details'])

        def test_missing_details_are_rejected_on_new_reports(self):
            response = self.report('Crime Against Person/Property')
            self.assertEqual(response.status_code, 400)
            self.assertIn('crime_type', response.data['details'])

        def test_standby_report_without_victims(self):
            response = self.report('Stand-by Medical Team', {
                'event_name': 'Pasayahan sa Lucena', 'venue': 'Perez Park', 'persons_assisted': 9,
                'cases_handled': ['heat_exhaustion', 'dizziness'],
            })
            self.assertEqual(response.status_code, 201, response.data)
            self.approve(response.data['id'])
            incident = Incident.objects.get(reference_code=response.data['incidentCode'])
            medical = MedicalEmergency.objects.get(incident=incident)
            self.assertEqual(medical.patient_count, 9)

            rejected = self.report('Stand-by Medical Team', {
                'event_name': 'Fun Run', 'venue': 'Plaza', 'persons_assisted': 1,
            }, victims=[{'name': 'A', 'age': '20', 'gender': 'F', 'address': 'x', 'condition': 'ok'}])
            self.assertEqual(rejected.status_code, 400)

        def test_older_report_without_details_can_still_be_approved(self):
            old = IncidentReport.objects.create(
                time_occurred='08:00', incident_type='Crime Against Person/Property', responder_team='Bravo',
                location='Barangay 1', latitude=Decimal('13.938781'), longitude=Decimal('121.610186'),
                description='Old report', action_taken='Assisted', status='Pending',
            )
            response = self.approve(old.id)
            self.assertEqual(response.status_code, 200, response.data)
            incident = Incident.objects.get(reference_code=old.incident_code)
            self.assertTrue(CrimeReport.objects.filter(incident=incident).exists())