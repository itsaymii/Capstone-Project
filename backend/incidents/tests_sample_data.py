"""
Tests for the sample data generator.

    python manage.py test incidents.tests_sample_data
"""

import random
from datetime import datetime, timezone as dt_timezone
from unittest import TestCase as PlainTestCase

from incidents.incident_types import INCIDENT_TYPES, validate_report_details
from incidents.sample_details import (
    sample_details,
    sample_report_datetime,
    sample_victim_details,
    victim_count_for,
)


class SampleDetailsTests(PlainTestCase):
    def test_samples_pass_the_same_validation_as_real_reports(self):
        rng = random.Random(42)
        now = datetime(2026, 10, 26, 8, 0, tzinfo=dt_timezone.utc)
        for incident_type in INCIDENT_TYPES:
            for _ in range(300):
                victim_count = victim_count_for(rng, incident_type)
                details = sample_details(rng, incident_type, victim_count, now, 'Market View')
                victims = [{'details': sample_victim_details(rng, incident_type, details)} for _ in range(victim_count)]
                cleaned, _, errors = validate_report_details(incident_type, details, victims)
                self.assertEqual(errors, {}, f'{incident_type}: {errors}')
                self.assertEqual(cleaned, details, incident_type)

    def test_victim_counts_follow_type_rules_and_never_trigger_critical_sms(self):
        rng = random.Random(1)
        for incident_type, config in INCIDENT_TYPES.items():
            for _ in range(200):
                count = victim_count_for(rng, incident_type)
                self.assertLessEqual(count, 4)
                self.assertGreaterEqual(count, config['victims']['min'])
                if config['victims']['max'] is not None:
                    self.assertLessEqual(count, config['victims']['max'])

    def test_drowning_outcomes_add_up_to_victims(self):
        rng = random.Random(3)
        now = datetime(2026, 1, 1, tzinfo=dt_timezone.utc)
        for _ in range(200):
            victims = victim_count_for(rng, 'Drowning')
            details = sample_details(rng, 'Drowning', victims, now, 'Dalahican')
            total = sum(details.get(key, 0) for key in ('rescued_alive', 'revived_cpr', 'fatalities', 'missing'))
            self.assertEqual(total, victims)

    def test_dates_stay_in_range_and_include_recent_reports(self):
        rng = random.Random(5)
        now = datetime(2026, 10, 26, tzinfo=dt_timezone.utc)
        dates = [sample_report_datetime(rng, 2023, 2026, now, recent_share=0.3) for _ in range(1000)]
        self.assertTrue(all(datetime(2023, 1, 1, tzinfo=dt_timezone.utc) <= d <= now for d in dates))
        recent = sum((now - d).days <= 120 for d in dates)
        self.assertGreater(recent, 250)


try:
    from django.core.management import call_command
    from django.test import TestCase as DjangoTestCase
except ImportError:  # running without Django installed
    DjangoTestCase = None


if DjangoTestCase is not None:
    from io import StringIO

    from django.contrib.auth.models import User

    from incidents.management.commands.generate_accomplishment_reports import BARANGAY_NAMES
    from incidents.models import Incident, IncidentReport, VehicularAccident, VictimDetail
    from locations.models import Barangay

    class GenerateCommandTests(DjangoTestCase):
        def setUp(self):
            for name in BARANGAY_NAMES:
                Barangay.objects.create(name=name)
            User.objects.create_user('responder_a', 'a@test.local', 'Pass12345', is_staff=True)

        def run_command(self, *args):
            out = StringIO()
            call_command('generate_accomplishment_reports', *args, stdout=out)
            return out.getvalue()

        def test_approved_reports_create_incidents_with_real_dates_and_details(self):
            self.run_command('--count', '60', '--approved', '--seed', '7')

            self.assertEqual(IncidentReport.objects.count(), 60)
            self.assertEqual(Incident.objects.count(), 60)
            self.assertTrue(all(report.details for report in IncidentReport.objects.all()))

            # Incidents keep the sample dates instead of all being today.
            dates = {incident.incident_datetime.date() for incident in Incident.objects.all()}
            self.assertGreater(len(dates), 10)

            # Detail rows are filled from the report details.
            accident = VehicularAccident.objects.first()
            if accident is not None:
                self.assertTrue(accident.vehicle_types)
                self.assertNotEqual(accident.cause, 'Created from approved report')

            # RCA victims carry their per-victim details.
            rca_victims = VictimDetail.objects.filter(incident_report__incident_type='RCA')
            self.assertTrue(all('person_role' in victim.details for victim in rca_victims))

        def test_pending_reports_do_not_create_incidents_and_codes_are_unique(self):
            self.run_command('--count', '40', '--seed', '3')
            self.run_command('--count', '40', '--seed', '4')

            self.assertEqual(IncidentReport.objects.filter(status='Pending').count(), 80)
            self.assertEqual(Incident.objects.count(), 0)
            codes = list(IncidentReport.objects.values_list('incident_code', flat=True))
            self.assertEqual(len(codes), len(set(codes)))

        def test_hotspots_get_the_most_reports_of_their_type(self):
            self.run_command('--count', '400', '--seed', '11')

            def top_barangay(incident_type):
                names = IncidentReport.objects.filter(incident_type=incident_type).values_list('barangay__name', flat=True)
                return max(set(names), key=list(names).count)

            self.assertEqual(top_barangay('RCA'), 'Domoit')
            self.assertEqual(top_barangay('Drowning'), 'Talao-Talao')
            self.assertEqual(top_barangay('Crime Against Person/Property'), 'Ibabang Dupay')
            self.assertIn(top_barangay('Fire Incident'), {'Ibabang Dupay', 'Barangay 1'})
            self.assertTrue(IncidentReport.objects.filter(location__startswith='Diversion Road, Stone Gate area').exists())

        def test_every_barangay_gets_reports_and_clear_replaces_old_data(self):
            self.run_command('--count', '150', '--approved', '--seed', '8')
            output = self.run_command('--count', '200', '--approved', '--clear', '--seed', '9')

            self.assertEqual(IncidentReport.objects.count(), 200)
            self.assertEqual(Incident.objects.count(), 200)
            for name in BARANGAY_NAMES:
                self.assertGreaterEqual(IncidentReport.objects.filter(barangay__name=name).count(), 3, name)
            self.assertIn('33 of 33 barangays have data', output)

        def test_reports_use_the_responder_account_as_team(self):
            self.run_command('--count', '20', '--seed', '2')
            self.assertEqual(set(IncidentReport.objects.values_list('responder_team', flat=True)), {'responder_a'})

        def test_points_land_inside_the_barangay_boundary(self):
            square = [[121.60, 13.93], [121.61, 13.93], [121.61, 13.94], [121.60, 13.94], [121.60, 13.93]]
            Barangay.objects.filter(name='Domoit').update(boundary={'type': 'Polygon', 'coordinates': [square]})
            self.run_command('--count', '200', '--seed', '5')
            for report in IncidentReport.objects.filter(barangay__name='Domoit'):
                self.assertTrue(13.93 <= report.latitude <= 13.94 and 121.60 <= report.longitude <= 121.61)