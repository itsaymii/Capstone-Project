"""
Tests for type-specific incident report details.

    python manage.py test incidents.tests_incident_details

The first two classes test the plain rules in incidents/incident_types.py.
ReportDetailsApiTests goes through the real API: create a report, then approve it.
"""

from decimal import Decimal
from unittest import TestCase as PlainTestCase
from unittest.mock import patch

from incidents.incident_types import (
    INCIDENT_TYPES,
    detail_table_values,
    fit_detail_values,
    get_incident_type,
    validate_report_details,
)
from incidents.severity import (
    score_drowning,
    score_crime_incident,
    score_earthquake,
    score_fire_incident,
    score_medical_emergency,
    score_road_crash,
    score_report_severity,
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
            'alarm_level': 'no_alarm',
            'structures_affected': '3',
            'families_affected': '0',
            'fatalities': '0',
            'estimated_damage': '150000.50',
            'bfp_present': 'true',
            'fire_out_time': '14:05',
            'suspected_cause': '',
        })
        self.assertEqual(errors, {})
        self.assertEqual(cleaned, {
            'structure_type': 'residential',
            'alarm_level': 'no_alarm',
            'structures_affected': 3,
            'families_affected': 0,
            'fatalities': 0,
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
        self.assertIn('fatalities', errors['details'])

    def test_scoring_metrics_require_explicit_zero_or_no(self):
        fire, _, fire_errors = validate_report_details('Fire Incident', {
            'structure_type': 'residential',
            'alarm_level': 'no_alarm',
        })
        self.assertEqual(fire, {'structure_type': 'residential', 'alarm_level': 'no_alarm'})
        self.assertEqual(set(fire_errors['details']), {'structures_affected', 'families_affected', 'fatalities'})

        drowning, _, drowning_errors = validate_report_details('Drowning', {'water_body': 'sea'})
        self.assertEqual(drowning, {'water_body': 'sea'})
        self.assertEqual(
            set(drowning_errors['details']),
            {'rescued_alive', 'revived_cpr', 'fatalities', 'missing', 'search_ongoing', 'coast_guard_involved'},
        )

        complete_drowning = {
            'water_body': 'sea',
            'rescued_alive': 0,
            'revived_cpr': 0,
            'fatalities': 0,
            'missing': 0,
            'search_ongoing': False,
            'coast_guard_involved': False,
        }
        cleaned, _, errors = validate_report_details('Drowning', complete_drowning)
        self.assertEqual(errors, {})
        self.assertEqual(cleaned['search_ongoing'], False)
        self.assertEqual(cleaned['fatalities'], 0)

    def test_bad_values_are_rejected(self):
        _, _, errors = validate_report_details('RCA', {
            'vehicles_involved': 0, 'vehicle_types': ['spaceship'], 'collision_type': 'head_on',
        })
        self.assertIn('vehicles_involved', errors['details'])
        self.assertIn('vehicle_types', errors['details'])

    def test_standby_has_no_victims(self):
        details = {
            'triage_acuity': 'green',
            'resource_utilization': 'on_site',
            'event_name': 'Pasayahan Festival',
            'venue': 'Perez Park',
            'persons_assisted': 12,
        }
        _, _, errors = validate_report_details('Stand-by Medical Team', details, [{'name': 'X'}])
        self.assertIn('victims', errors)
        _, _, errors = validate_report_details('Stand-by Medical Team', details, [])
        self.assertEqual(errors, {})

    def test_medical_needs_a_patient_and_ambulance_only_one(self):
        medical = {
            'triage_acuity': 'green',
            'resource_utilization': 'on_site',
            'chief_complaint': 'seizure',
            'consciousness': 'alert',
        }
        self.assertIn('victims', validate_report_details('Medical Emergency', medical, [])[2])
        ambulance = {
            'triage_acuity': 'yellow',
            'resource_utilization': 'basic_ambulance',
            'pickup_location': 'Brgy 1',
            'destination_hospital': 'QMC',
            'transport_reason': 'referral',
        }
        self.assertEqual(validate_report_details('Ambulance Assistance', ambulance, [{}])[2], {})
        self.assertIn('victims', validate_report_details('Ambulance Assistance', ambulance, [{}, {}])[2])

    def test_medical_categories_require_triage_and_resource_fields(self):
        cases = [
            ('Medical Emergency', {
                'chief_complaint': 'seizure', 'consciousness': 'alert',
            }, [{}]),
            ('Ambulance Assistance', {
                'pickup_location': 'Brgy 1',
                'destination_hospital': 'QMC',
                'transport_reason': 'referral',
            }, [{}]),
            ('Stand-by Medical Team', {
                'event_name': 'Festival', 'venue': 'Park', 'persons_assisted': 0,
            }, []),
        ]
        for incident_type, details, victims in cases:
            with self.subTest(incident_type=incident_type):
                errors = validate_report_details(incident_type, details, victims)[2]
                self.assertIn('triage_acuity', errors['details'])
                self.assertIn('resource_utilization', errors['details'])

    def test_victim_fields_are_per_type(self):
        details = {
            'vehicles_involved': 1,
            'vehicle_types': ['motorcycle'],
            'collision_type': 'self_accident',
            'fatalities': 0,
        }
        _, victim_details, errors = validate_report_details('RCA', details, [
            {'details': {
                'person_role': 'driver',
                'injury_severity': 'minor_first_aid',
                'protective_gear': 'helmet',
            }},
        ])
        self.assertEqual(errors, {})
        self.assertEqual(victim_details, [{
            'person_role': 'driver',
            'injury_severity': 'minor_first_aid',
            'protective_gear': 'helmet',
        }])

        _, _, errors = validate_report_details('RCA', details, [{'details': {'pulse_rate': 80}}])
        self.assertIn('victims', errors)

    def test_rca_injury_severity_is_required_for_each_person(self):
        _, _, errors = validate_report_details('RCA', {
            'vehicles_involved': 1,
            'vehicle_types': ['car'],
            'collision_type': 'rear_end',
        }, [{'details': {'person_role': 'driver'}}])
        self.assertIn('injury_severity', errors['victims']['#1'])

    def test_crime_victim_outcome_is_required_and_cleaned(self):
        crime_details = {'crime_type': 'physical_injury'}
        _, victim_details, errors = validate_report_details(
            'Crime Against Person/Property',
            crime_details,
            [{'details': {'outcome': 'injured'}}],
        )
        self.assertEqual(errors, {})
        self.assertEqual(victim_details, [{'outcome': 'injured'}])

        _, _, errors = validate_report_details(
            'Crime Against Person/Property',
            crime_details,
            [{'details': {}}],
        )
        self.assertIn('outcome', errors['victims']['#1'])

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
        self.assertEqual(detail_table_values('Stand-by Medical Team', {
            'persons_assisted': 7, 'event_name': 'Fun Run',
            'triage_acuity': 'green', 'resource_utilization': 'on_site',
        }, 0),
                         ('medical', {'patient_count': 7, 'emergency_type': 'Stand-by Medical Team: Fun Run',
                                      'transported': 0, 'hospital': '', 'triage_acuity': 'green',
                                      'resource_utilization': 'on_site'}))
        table, values = detail_table_values('Ambulance Assistance', {
            'destination_hospital': 'QMC', 'transport_reason': 'dialysis',
            'triage_acuity': 'yellow', 'resource_utilization': 'basic_ambulance',
        }, 1)
        self.assertEqual((table, values['hospital'], values['emergency_type']), ('medical', 'QMC', 'Ambulance Assistance: Dialysis'))
        self.assertEqual((values['triage_acuity'], values['resource_utilization']), ('yellow', 'basic_ambulance'))

    def test_drowning_counts_rescued(self):
        _, values = detail_table_values('Drowning', {
            'water_body': 'river', 'rescued_alive': 2, 'revived_cpr': 1, 'fatalities': 1,
        }, 4)
        self.assertEqual(values, {'victims': 4, 'rescued': 3, 'fatalities': 1, 'water_body': 'River'})

    def test_empty_details_still_work(self):
        for label in INCIDENT_TYPES:
            table, values = detail_table_values(label, {}, 0)
            self.assertIsNotNone(table, label)

    def test_long_text_is_trimmed_to_column_size(self):
        values = fit_detail_values('medical', {'emergency_type': 'x' * 150, 'patient_count': 1})
        self.assertEqual(len(values['emergency_type']), 100)


class RoadCrashSeverityTests(PlainTestCase):
    def score(self, fatalities=0, vehicles=1, injuries=()):
        return score_road_crash(
            {'fatalities': fatalities, 'vehicles_involved': vehicles},
            [{'injury_severity': injury} for injury in injuries],
        )

    def test_weighted_metric_points_and_rating_bands(self):
        cases = [
            ({}, (), 0, 'low'),
            ({'fatalities': 1}, (), 20, 'low'),
            ({'vehicles_involved': 2}, (), 15, 'low'),
            ({'vehicles_involved': 2}, ('minor_first_aid',), 25, 'low'),
            ({'vehicles_involved': 3}, (), 30, 'moderate'),
            ({'fatalities': 2}, (), 40, 'moderate'),
            ({'fatalities': 1, 'vehicles_involved': 3}, (), 50, 'moderate'),
            ({'fatalities': 2, 'vehicles_involved': 2}, ('severe_hospital_transport',), 75, 'high'),
            ({'fatalities': 2, 'vehicles_involved': 3}, ('minor_first_aid',), 80, 'critical'),
            ({'fatalities': 2, 'vehicles_involved': 3}, (
                'minor_first_aid', 'minor_first_aid', 'minor_first_aid',
            ), 100, 'critical'),
            ({'fatalities': 1, 'vehicles_involved': 3}, ('severe_hospital_transport',), 70, 'high'),
            ({'fatalities': 2, 'vehicles_involved': 3}, ('severe_hospital_transport',), 90, 'critical'),
        ]
        for details, injuries, expected_score, expected_severity in cases:
            with self.subTest(details=details, injuries=injuries):
                result = score_road_crash(details, [{'injury_severity': value} for value in injuries])
                self.assertEqual(result['score'], expected_score)
                self.assertEqual(result['severity'], expected_severity)

    def test_worst_injury_controls_points_and_three_injured_people_trigger_mci_tier(self):
        result = self.score(
            injuries=('minor_first_aid', 'severe_hospital_transport', 'none'),
        )
        self.assertEqual(result['injury_points'], 20)

        result = self.score(
            injuries=('minor_first_aid', 'none', 'severe_hospital_transport', 'minor_first_aid'),
        )
        self.assertEqual(result['injury_points'], 30)


class EarthquakeSeverityTests(PlainTestCase):
    def test_magnitude_and_depth_points_and_bands(self):
        cases = [
            ('3.9', '70', None, 20, 'low'),
            ('4.0', '70', None, 30, 'moderate'),
            ('5.0', '70.01', None, 25, 'low'),
            ('6.0', '300', None, 30, 'moderate'),
            ('7.0', '300.01', None, 30, 'moderate'),
            ('7.0', '70', None, 50, 'moderate'),
        ]
        for magnitude, depth, intensity, expected_score, expected_severity in cases:
            with self.subTest(magnitude=magnitude, depth=depth):
                result = score_earthquake(magnitude, depth, intensity)
                self.assertEqual(result['score'], expected_score)
                self.assertEqual(result['severity'], expected_severity)

    def test_peis_points_are_added_when_present(self):
        self.assertEqual(score_earthquake('4.0', '70', 'PEIS VIII')['score'], 75)
        self.assertEqual(score_earthquake('4.0', '70', 'X')['score'], 80)
        missing_peis = score_earthquake('7.0', '70', None)
        self.assertEqual(missing_peis['score'], 50)
        self.assertEqual(missing_peis['intensity_points'], 0)


class MedicalEmergencySeverityTests(PlainTestCase):
    def test_weighted_metric_points_and_rating_bands(self):
        cases = [
            ('green', 1, 'on_site', 0, 'low'),
            ('yellow', 1, 'on_site', 20, 'low'),
            ('red', 1, 'on_site', 40, 'moderate'),
            ('green', 2, 'basic_ambulance', 30, 'moderate'),
            ('yellow', 3, 'basic_ambulance', 65, 'high'),
            ('red', 3, 'advanced_response', 100, 'critical'),
        ]
        for acuity, count, resource, expected_score, expected_severity in cases:
            with self.subTest(acuity=acuity, count=count, resource=resource):
                result = score_medical_emergency(acuity, count, resource)
                self.assertEqual(result['score'], expected_score)
                self.assertEqual(result['severity'], expected_severity)
        self.assertEqual(score_medical_emergency('none', 0, 'on_site')['score'], 0)


class DrowningSeverityTests(PlainTestCase):
    def test_vital_status_points_add_missing_and_fatality_tiers(self):
        cases = [
            ({}, 0, 'low'),
            ({'missing': 1}, 10, 'low'),
            ({'missing': 2}, 20, 'low'),
            ({'fatalities': 1}, 20, 'low'),
            ({'fatalities': 2}, 40, 'moderate'),
            ({'fatalities': 1, 'missing': 1}, 30, 'moderate'),
            ({'fatalities': 2, 'missing': 2}, 60, 'high'),
        ]
        for details, expected_score, expected_severity in cases:
            with self.subTest(details=details):
                result = score_drowning(details)
                self.assertEqual(result['vital_status_points'], expected_score)
                self.assertEqual(result['severity'], expected_severity)

    def test_survivor_count_uses_rescued_and_cpr_revived_counts(self):
        cases = [
            ({'rescued_alive': 1}, 0),
            ({'rescued_alive': 1, 'revived_cpr': 1}, 10),
            ({'rescued_alive': 2, 'revived_cpr': 1}, 10),
            ({'rescued_alive': 3, 'revived_cpr': 1}, 20),
        ]
        for details, expected_points in cases:
            with self.subTest(details=details):
                self.assertEqual(score_drowning(details)['survivor_points'], expected_points)

    def test_rescue_complexity_awards_ten_for_either_condition_and_twenty_for_both(self):
        cases = [
            ({}, 0),
            ({'search_ongoing': True}, 10),
            ({'coast_guard_involved': True}, 10),
            ({'search_ongoing': True, 'coast_guard_involved': True}, 20),
        ]
        for details, expected_points in cases:
            with self.subTest(details=details):
                self.assertEqual(score_drowning(details)['rescue_complexity_points'], expected_points)


class FireIncidentSeverityTests(PlainTestCase):
    def test_alarm_level_points_include_no_alarm_and_task_force_levels(self):
        cases = [
            ('no_alarm', 0),
            ('under_control', 0),
            ('fire_out', 0),
            ('first', 15),
            ('second', 25),
            ('third', 40),
            ('fourth', 40),
            ('fifth', 40),
            ('task_force_alpha', 40),
            ('task_force_bravo', 40),
        ]
        for alarm_level, expected_points in cases:
            with self.subTest(alarm_level=alarm_level):
                result = score_fire_incident({'alarm_level': alarm_level}, 0)
                self.assertEqual(result['alarm_points'], expected_points)

    def test_displacement_points_use_the_higher_family_or_structure_tier(self):
        cases = [
            ({'families_affected': 0, 'structures_affected': 0}, 0),
            ({'families_affected': 5, 'structures_affected': 0}, 10),
            ({'families_affected': 5, 'structures_affected': 6}, 20),
            ({'families_affected': 20, 'structures_affected': 0}, 20),
            ({'families_affected': 0, 'structures_affected': 21}, 30),
        ]
        for details, expected_points in cases:
            with self.subTest(details=details):
                result = score_fire_incident(details, 0)
                self.assertEqual(result['displacement_points'], expected_points)

    def test_casualty_points_add_fatalities_and_injuries(self):
        cases = [
            ({'fatalities': 0}, 0, 0),
            ({'fatalities': 1}, 1, 10),
            ({'fatalities': 1}, 2, 20),
            ({'fatalities': 2}, 4, 30),
        ]
        for details, injuries, expected_points in cases:
            with self.subTest(details=details, injuries=injuries):
                result = score_fire_incident(details, injuries)
                self.assertEqual(result['casualty_points'], expected_points)


class CrimeIncidentSeverityTests(PlainTestCase):
    def score(self, outcomes):
        return score_crime_incident([{'outcome': outcome} for outcome in outcomes])

    def test_fatality_injury_and_victim_count_tiers(self):
        cases = [
            ([], 0, 'low'),
            (['deceased'], 20, 'low'),
            (['deceased', 'deceased'], 40, 'moderate'),
            (['injured'], 15, 'low'),
            (['injured', 'injured'], 15, 'low'),
            (['injured'] * 3, 35, 'moderate'),
            (['injured'] * 6, 60, 'high'),
            (['not_injured'] * 3, 10, 'low'),
            (['not_injured'] * 6, 20, 'low'),
            (['deceased', 'deceased'] + ['injured'] * 6 + ['not_injured'] * 2, 100, 'critical'),
        ]
        for outcomes, expected_score, expected_severity in cases:
            with self.subTest(outcomes=outcomes):
                result = self.score(outcomes)
                self.assertEqual(result['score'], expected_score)
                self.assertEqual(result['severity'], expected_severity)


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

        def report(self, incident_type, details=None, victims=None, victim_count=None):
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
            if victim_count is not None:
                payload['victimCount'] = victim_count
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
                'suspected_cause': 'electrical', 'structures_affected': 3, 'families_affected': 0,
                'fatalities': 0, 'estimated_damage': 500000,
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

        def test_fire_severity_uses_alarm_displacement_and_combined_casualties(self):
            victims = [
                {
                    'name': f'Person {index}',
                    'age': '30',
                    'gender': 'M',
                    'address': 'Market View',
                    'condition': 'Burn injuries',
                    'details': {'injury_type': 'burns'},
                }
                for index in range(3)
            ]
            response = self.report('Fire Incident', {
                'structure_type': 'residential',
                'alarm_level': 'third',
                'structures_affected': 21,
                'families_affected': 0,
                'fatalities': 1,
            }, victims=victims)
            self.assertEqual(response.status_code, 201, response.data)

            report = IncidentReport.objects.get(id=response.data['id'])
            self.assertEqual(self.approve(report.id).status_code, 200)

            incident = Incident.objects.get(reference_code=report.incident_code)
            self.assertEqual(incident.severity_level, 'critical')

        def test_crime_severity_uses_structured_victim_outcomes(self):
            victims = [
                ('deceased', 'Fatal injuries'),
                ('injured', 'Stab wound'),
                ('injured', 'Bruises'),
                ('injured', 'Fracture'),
                ('not_injured', 'No physical injury'),
            ]
            response = self.report('Crime Against Person/Property', {
                'crime_type': 'physical_injury',
            }, victims=[
                {
                    'name': f'Person {index}',
                    'age': '30',
                    'gender': 'M',
                    'address': 'Market View',
                    'condition': condition,
                    'details': {'outcome': outcome},
                }
                for index, (outcome, condition) in enumerate(victims)
            ], victim_count=12)
            self.assertEqual(response.status_code, 201, response.data)

            report = IncidentReport.objects.get(id=response.data['id'])
            self.assertEqual(report.victims.count(), 5)
            self.assertEqual(report.victim_count, 5)
            self.assertCountEqual(
                [victim.details['outcome'] for victim in report.victims.all()],
                ['deceased', 'injured', 'injured', 'injured', 'not_injured'],
            )
            self.assertEqual(self.approve(report.id).status_code, 200)

            incident = Incident.objects.get(reference_code=report.incident_code)
            # 1 fatality (20) + 3 injuries (25) + 5 victims (10) = 55, High.
            self.assertEqual(incident.severity_level, 'high')

        def test_road_crash_severity_uses_weighted_metrics_on_approval(self):
            victims = [
                {
                    'name': f'Person {index}',
                    'age': '30',
                    'gender': 'M',
                    'address': 'Market View',
                    'condition': 'Transported to hospital',
                    'details': {
                        'person_role': 'driver',
                        'injury_severity': 'severe_hospital_transport',
                    },
                }
                for index in range(3)
            ]
            response = self.report('RCA', {
                'vehicles_involved': 3,
                'vehicle_types': ['car'],
                'collision_type': 'rear_end',
                'fatalities': 1,
            }, victims=victims)
            self.assertEqual(response.status_code, 201, response.data)

            report = IncidentReport.objects.get(id=response.data['id'])
            self.assertEqual(self.approve(report.id).status_code, 200)

            incident = Incident.objects.get(reference_code=report.incident_code)
            self.assertEqual(incident.severity_level, 'critical')
            self.assertEqual(
                report.victims.first().details['injury_severity'],
                'severe_hospital_transport',
            )

        def test_medical_emergency_severity_uses_worst_triage_count_and_resources(self):
            victims = [
                {
                    'name': f'Patient {index}',
                    'age': '30',
                    'gender': 'F',
                    'address': 'Market View',
                    'condition': 'Treated on scene',
                    'details': {},
                }
                for index in range(3)
            ]
            response = self.report('Medical Emergency', {
                'triage_acuity': 'red',
                'resource_utilization': 'advanced_response',
                'chief_complaint': 'difficulty_breathing',
                'consciousness': 'pain',
            }, victims=victims)
            self.assertEqual(response.status_code, 201, response.data)

            report = IncidentReport.objects.get(id=response.data['id'])
            self.assertEqual(self.approve(report.id).status_code, 200)

            incident = Incident.objects.get(reference_code=report.incident_code)
            medical = MedicalEmergency.objects.get(incident=incident)
            self.assertEqual(incident.severity_level, 'critical')
            self.assertEqual(medical.patient_count, 3)
            self.assertEqual(medical.triage_acuity, 'red')
            self.assertEqual(medical.resource_utilization, 'advanced_response')

        def test_legacy_medical_report_without_new_fields_keeps_existing_severity_mapping(self):
            report = IncidentReport.objects.create(
                time_occurred='08:00',
                incident_type='Medical Emergency',
                responder_team='Alpha',
                location='Barangay 1',
                latitude=Decimal('13.938781'),
                longitude=Decimal('121.610186'),
                description='Legacy medical report',
                action_taken='Assisted',
                victim_count=3,
                status='Pending',
            )

            response = self.approve(report.id)

            self.assertEqual(response.status_code, 200, response.data)
            incident = Incident.objects.get(reference_code=report.incident_code)
            self.assertEqual(incident.severity_level, 'high')

        def test_ambulance_assistance_and_standby_use_the_medical_rubric(self):
            ambulance = self.report('Ambulance Assistance', {
                'triage_acuity': 'yellow',
                'resource_utilization': 'basic_ambulance',
                'pickup_location': 'Brgy 1',
                'destination_hospital': 'QMC',
                'transport_reason': 'referral',
            }, victims=[{
                'name': 'Patient',
                'age': '40',
                'gender': 'M',
                'address': 'Brgy 1',
                'condition': 'Stable',
            }])
            self.assertEqual(ambulance.status_code, 201, ambulance.data)
            ambulance_report = IncidentReport.objects.get(id=ambulance.data['id'])
            self.assertEqual(self.approve(ambulance_report.id).status_code, 200)
            ambulance_incident = Incident.objects.get(reference_code=ambulance_report.incident_code)
            self.assertEqual(ambulance_incident.severity_level, 'moderate')

            standby = self.report('Stand-by Medical Team', {
                'triage_acuity': 'green',
                'resource_utilization': 'on_site',
                'event_name': 'Fun Run',
                'venue': 'Perez Park',
                'persons_assisted': 3,
            })
            self.assertEqual(standby.status_code, 201, standby.data)
            standby_report = IncidentReport.objects.get(id=standby.data['id'])
            self.assertEqual(self.approve(standby_report.id).status_code, 200)
            standby_incident = Incident.objects.get(reference_code=standby_report.incident_code)
            self.assertEqual(standby_incident.severity_level, 'moderate')

        def test_drowning_severity_uses_aggregate_outcomes_and_rescue_complexity(self):
            response = self.report('Drowning', {
                'water_body': 'sea',
                'rescued_alive': 2,
                'revived_cpr': 1,
                'fatalities': 1,
                'missing': 1,
                'search_ongoing': True,
                'coast_guard_involved': True,
            }, victims=[
                {
                    'name': f'Victim {index}',
                    'age': '30',
                    'gender': 'M',
                    'address': 'Lucena',
                    'condition': 'Rescued',
                }
                for index in range(4)
            ])
            self.assertEqual(response.status_code, 201, response.data)

            report = IncidentReport.objects.get(id=response.data['id'])
            self.assertEqual(self.approve(report.id).status_code, 200)

            incident = Incident.objects.get(reference_code=report.incident_code)
            self.assertEqual(incident.severity_level, 'high')

        def test_approval_failure_is_returned_and_report_update_rolls_back(self):
            response = self.report('Medical Emergency', {
                'triage_acuity': 'yellow',
                'resource_utilization': 'on_site',
                'chief_complaint': 'seizure',
                'consciousness': 'alert',
            }, victims=[{
                'name': 'Patient',
                'age': '30',
                'gender': 'F',
                'address': 'Market View',
                'condition': 'Treated on scene',
            }])
            self.assertEqual(response.status_code, 201, response.data)

            report = IncidentReport.objects.get(pk=response.data['id'])
            with patch('incidents.signals.Incident.objects.create', side_effect=RuntimeError('incident create failed')):
                with self.assertRaisesMessage(RuntimeError, 'incident create failed'):
                    self.approve(report.id)

            report.refresh_from_db()
            self.assertEqual(report.status, 'Pending')
            self.assertIsNone(report.incident_id)
            self.assertFalse(Incident.objects.filter(reference_code=report.incident_code).exists())

        def test_shared_report_scorer_uses_rubric_and_preserves_legacy_fallback(self):
            severity = score_report_severity(
                'RCA',
                {'fatalities': 1, 'vehicles_involved': 3},
                [{'injury_severity': 'severe_hospital_transport'} for _ in range(3)],
                3,
            )
            self.assertEqual(severity, 'critical')
            self.assertEqual(
                score_report_severity('RCA', {}, [], 3),
                'high',
            )

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
                'triage_acuity': 'green',
                'resource_utilization': 'on_site',
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