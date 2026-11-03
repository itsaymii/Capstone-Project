from datetime import time
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from incidents.models import (
    AccomplishmentReport,
    HazardType,
    Incident,
    IncidentReport,
    ResponderTeam,
    VehicularAccident,
)
from incidents.serializers import AccomplishmentReportSerializer, VehicularAccidentSerializer


class ReportNormalizationTests(TestCase):
    def create_report(self, **overrides):
        values = {
            'time_occurred': time(12, 0),
            'incident_type': 'Fire Incident',
            'responder_team': 'Alpha',
            'description': 'Test report',
            'action_taken': 'Test response',
        }
        values.update(overrides)
        return IncidentReport.objects.create(**values)

    def test_approval_links_report_to_created_incident(self):
        report = self.create_report()

        report.status = 'Approved'
        report.save(update_fields=['status'])
        report.refresh_from_db()

        self.assertIsNotNone(report.incident)
        self.assertEqual(report.incident.reference_code, report.incident_code)

    def test_approval_links_report_to_existing_incident(self):
        hazard = HazardType.objects.create(name='Fire')
        incident = Incident.objects.create(
            reference_code='INC-2026-90001',
            hazard_type=hazard,
            latitude=Decimal('13.940000'),
            longitude=Decimal('121.610000'),
            incident_datetime=timezone.now(),
            severity_level='low',
            description='Existing incident',
        )
        report = self.create_report(incident_code=incident.reference_code)

        report.status = 'Approved'
        report.save(update_fields=['status'])
        report.refresh_from_db()

        self.assertEqual(report.incident_id, incident.pk)

    def test_accomplishment_report_count_is_derived_from_related_reports(self):
        accomplishment = AccomplishmentReport.objects.create()
        reports = [self.create_report(), self.create_report()]
        accomplishment.incident_reports.set(reports)

        serialized = AccomplishmentReportSerializer(accomplishment).data

        self.assertEqual(accomplishment.total_reports, 2)
        self.assertEqual(serialized['totalReports'], 2)

    def test_responder_team_aliases_link_to_canonical_records(self):
        report = self.create_report(responder_team='  alpha  ')
        report.refresh_from_db()

        self.assertEqual(report.responder_team_record.code, 'alpha')
        self.assertEqual(ResponderTeam.objects.get(code='alpha').name, 'Team Alpha')

    def test_personal_legacy_name_is_preserved_without_team_assignment(self):
        report = self.create_report(responder_team='Julius Responder')
        report.refresh_from_db()

        self.assertIsNone(report.responder_team_record)
        self.assertEqual(report.responder_team, 'Julius Responder')

    def test_vehicle_types_are_related_rows_but_keep_the_existing_api_string(self):
        hazard = HazardType.objects.create(name='Vehicular Accident')
        incident = Incident.objects.create(
            reference_code='INC-2026-90002',
            hazard_type=hazard,
            latitude=Decimal('13.940000'),
            longitude=Decimal('121.610000'),
            incident_datetime=timezone.now(),
            severity_level='low',
            description='Vehicle type test',
        )
        accident = VehicularAccident.objects.create(
            incident=incident,
            vehicle_types='Motorcycle, Jeepney',
        )

        self.assertEqual(accident.vehicle_type_records.count(), 2)
        self.assertEqual(accident.vehicle_types, 'Motorcycle, Jeepney')
        self.assertEqual(VehicularAccidentSerializer(accident).data['vehicle_types'], 'Motorcycle, Jeepney')
