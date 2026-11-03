"""
Prepare existing data so every admin dashboard page has something to show.

What it does (safe to run more than once, nothing is deleted):

1. Converts old ResponderReport rows (table `responder_reports`) into the newer
   IncidentReport rows (table `incident_reports`) that the Incidents and Reports
   pages read. Each converted report reuses its incident's reference code, gets
   status "Approved", and keeps the victim details found in the old report text.
2. Compiles AccomplishmentReports: one per responder team per month, from the
   approved incident reports, for the Accomplishment page.
3. (Optional, --shift-dates) Moves all incident and report dates forward by the
   same number of days so the newest record lands on today. Use this for demo or
   sample data, so pages that default to "last 90 days" (like Scoring) show data.
4. Recalculates stored barangay risk scores.

Rows are written with bulk_create / update, so no SMS alerts are sent and no
duplicate Incidents are created by the approval signal.

Usage:
    python manage.py prepare_dashboard_data
    python manage.py prepare_dashboard_data --shift-dates
"""

import re
from collections import defaultdict
from datetime import timedelta

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F, Max
from django.utils import timezone

from incidents.models import (
    AccomplishmentReport,
    Incident,
    IncidentReport,
    ResponderReport,
    VictimDetail,
)

# Hazard type name (backend) -> incident type label used by the responder form.
HAZARD_TO_INCIDENT_TYPE = {
    'fire': 'Fire Incident',
    'vehicular accident': 'RCA',
    'accident': 'RCA',
    'crime': 'Crime Against Person/Property',
    'medical emergency': 'Medical Emergency',
    'drowning': 'Drowning',
}

TEAMS = ['Alpha', 'Bravo', 'Charlie']

# Old report text looks like:
# "Victim: James Clark, 26y/o F. Condition: Fractured Right Knee Cap. Address: Barangay 11 (Pob.)."
VICTIM_PATTERN = re.compile(
    r'Victim:\s*(?P<name>.+?),\s*(?P<age>\d+)\s*y/o\s*(?P<gender>[MF])\.\s*'
    r'Condition:\s*(?P<condition>.+?)\.\s*Address:\s*(?P<address>.+?)\.?\s*$'
)


def incident_type_for(incident):
    name = (incident.hazard_type.name if incident.hazard_type_id else '').strip().lower()
    return HAZARD_TO_INCIDENT_TYPE.get(name, incident.hazard_type.name if incident.hazard_type_id else 'Incident')


class Command(BaseCommand):
    help = 'Fill the Incidents, Accomplishment, and Scoring pages from existing incident data.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--shift-dates',
            action='store_true',
            help='Move all incident/report dates forward so the newest one is today (for sample data).',
        )
        parser.add_argument(
            '--skip-risk-scores',
            action='store_true',
            help='Do not recalculate stored barangay risk scores.',
        )

    def handle(self, *args, **options):
        if options['shift_dates']:
            self.shift_dates()

        self.convert_responder_reports()
        self.compile_accomplishment_reports()

        if not options['skip_risk_scores']:
            self.stdout.write('Recalculating barangay risk scores (last 365 days)...')
            call_command('calculate_risk_scores', days=365)

        self.stdout.write(self.style.SUCCESS(
            'Done. Incident reports: %d, accomplishment reports: %d, incidents: %d.' % (
                IncidentReport.objects.count(),
                AccomplishmentReport.objects.count(),
                Incident.objects.count(),
            )
        ))

    # ------------------------------------------------------------------ dates
    @transaction.atomic
    def shift_dates(self):
        latest = Incident.objects.aggregate(latest=Max('incident_datetime'))['latest']
        if latest is None:
            self.stdout.write('No incidents found; nothing to shift.')
            return

        delta_days = (timezone.now() - latest).days
        if delta_days <= 0:
            self.stdout.write('Newest incident is already recent; dates not shifted.')
            return

        delta = timedelta(days=delta_days)
        Incident.objects.update(
            incident_datetime=F('incident_datetime') + delta,
            date_reported=F('date_reported') + delta,
            created_at=F('created_at') + delta,
        )
        IncidentReport.objects.update(created_at=F('created_at') + delta)
        ResponderReport.objects.update(report_time=F('report_time') + delta)
        AccomplishmentReport.objects.update(created_at=F('created_at') + delta)

        self.stdout.write(self.style.SUCCESS(f'Shifted all dates forward by {delta_days} days.'))

    # ---------------------------------------------------------- incident reports
    @transaction.atomic
    def convert_responder_reports(self):
        existing_codes = set(IncidentReport.objects.values_list('incident_code', flat=True))

        # Continue each year's IR-YYYY-NNNNN sequence after the highest existing code.
        next_number = defaultdict(int)
        for code in IncidentReport.objects.values_list('report_code', flat=True):
            match = re.match(r'IR-(\d{4})-(\d+)$', code or '')
            if match:
                year, number = match.group(1), int(match.group(2))
                next_number[year] = max(next_number[year], number)

        old_reports = (
            ResponderReport.objects
            .select_related('incident', 'incident__hazard_type', 'incident__barangay', 'responder')
            .order_by('incident__incident_datetime', 'report_time')
        )

        team_for_responder = {}
        new_reports = []
        victims = []
        created_at_by_code = {}

        for old in old_reports:
            incident = old.incident
            code = incident.reference_code
            if not code or code in existing_codes:
                continue
            existing_codes.add(code)

            occurred = timezone.localtime(incident.incident_datetime)
            year = str(occurred.year)
            next_number[year] += 1

            if old.responder_id not in team_for_responder:
                team_for_responder[old.responder_id] = TEAMS[len(team_for_responder) % len(TEAMS)]

            barangay_name = incident.barangay.name if incident.barangay_id else ''
            location = incident.address or (f'{barangay_name}, Lucena City' if barangay_name else 'Lucena City')

            victim_match = VICTIM_PATTERN.match((old.report_text or '').strip())

            report = IncidentReport(
                report_code=f'IR-{year}-{next_number[year]:05d}',
                incident_code=code,
                time_occurred=occurred.time().replace(microsecond=0),
                incident_type=incident_type_for(incident),
                responder_team=team_for_responder[old.responder_id],
                location=location,
                barangay=incident.barangay,
                latitude=incident.latitude,
                longitude=incident.longitude,
                description=incident.description or old.report_text or '',
                victim_count=1 if victim_match else 0,
                action_taken=old.action_taken or '',
                status='Approved',
                created_by=old.responder,
            )
            new_reports.append(report)
            created_at_by_code[code] = incident.incident_datetime

            if victim_match:
                victims.append((report, victim_match.groupdict()))

        if not new_reports:
            self.stdout.write('Incident reports: nothing to convert (already done).')
            return

        IncidentReport.objects.bulk_create(new_reports, batch_size=500)

        VictimDetail.objects.bulk_create(
            [
                VictimDetail(
                    incident_report=report,
                    name=data['name'].strip(),
                    age=data['age'],
                    gender=data['gender'],
                    address=data['address'].strip(),
                    condition=data['condition'].strip(),
                )
                for report, data in victims
            ],
            batch_size=500,
        )

        # created_at is auto_now_add, so set the real report date afterwards.
        for code, created_at in created_at_by_code.items():
            IncidentReport.objects.filter(incident_code=code).update(created_at=created_at)

        self.stdout.write(self.style.SUCCESS(
            f'Incident reports: converted {len(new_reports)} old responder reports '
            f'({len(victims)} with victim details).'
        ))

    # ------------------------------------------------------ accomplishment reports
    @transaction.atomic
    def compile_accomplishment_reports(self):
        already_compiled = set(
            AccomplishmentReport.objects.values_list('incident_reports__id', flat=True)
        )

        groups = defaultdict(list)
        approved = IncidentReport.objects.filter(status__iexact='approved').order_by('created_at')
        for report in approved:
            if report.id in already_compiled:
                continue
            local = timezone.localtime(report.created_at)
            groups[(local.year, local.month, report.responder_team or 'Responder')].append(report)

        if not groups:
            self.stdout.write('Accomplishment reports: nothing new to compile.')
            return

        for (year, month, team), reports in sorted(groups.items()):
            month_name = timezone.localtime(reports[0].created_at).strftime('%B')
            accomplishment = AccomplishmentReport.objects.create(
                title=f'{team} Team - {month_name} {year}'[:100],
                status='Compiled',
                # Left empty on purpose: the Accomplishment page only lists reports that
                # were not compiled by an admin/staff account.
                compiled_by=None,
            )
            accomplishment.incident_reports.set(reports)
            AccomplishmentReport.objects.filter(pk=accomplishment.pk).update(
                created_at=max(report.created_at for report in reports)
            )

        self.stdout.write(self.style.SUCCESS(
            f'Accomplishment reports: compiled {len(groups)} monthly team reports.'
        ))
