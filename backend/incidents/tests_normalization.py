from datetime import datetime, time
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

    def test_delayed_approval_uses_report_filing_date_for_incident_date(self):
        filed_at = timezone.make_aware(datetime(2026, 3, 5, 15, 0))
        report = self.create_report(time_occurred=time(14, 30))
        IncidentReport.objects.filter(pk=report.pk).update(created_at=filed_at)
        report.refresh_from_db()

        report.status = 'Approved'
        report.save(update_fields=['status'])

        incident = Incident.objects.get(reference_code=report.incident_code)
        expected = timezone.make_aware(datetime(2026, 3, 5, 14, 30))
        self.assertEqual(incident.incident_datetime, expected)

    def test_report_after_midnight_can_represent_previous_evening_incident(self):
        filed_at = timezone.make_aware(datetime(2026, 3, 5, 0, 20))
        report = self.create_report(time_occurred=time(23, 50))
        IncidentReport.objects.filter(pk=report.pk).update(created_at=filed_at)
        report.refresh_from_db()

        report.status = 'Approved'
        report.save(update_fields=['status'])

        incident = Incident.objects.get(reference_code=report.incident_code)
        expected = timezone.make_aware(datetime(2026, 3, 4, 23, 50))
        self.assertEqual(incident.incident_datetime, expected)

    def test_approval_parses_string_time_from_direct_orm_report(self):
        report = self.create_report()
        report.time_occurred = '23:50'
        report.status = 'Approved'
        report.save(update_fields=['status', 'time_occurred'])

        incident = Incident.objects.get(reference_code=report.incident_code)
        self.assertEqual(timezone.localtime(incident.incident_datetime).time(), time(23, 50))

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
