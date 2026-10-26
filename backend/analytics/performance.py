# analytics/performance.py
"""
Responsiveness and performance of the emergency response teams.

Data used (what the system records today):
- Approved responder reports (IncidentReport): the team (responder_team), the time the
  incident happened (time_occurred) and when the report was filed (created_at).
- The incident created when a report is approved (Incident, matched by incident code):
  severity and status (resolved / contained count as resolved).
- ResponderReport, when responders log actions on an incident: time of the first action.

Response time here is the time from when the incident happened to when the responder filed
the report. The system does not record dispatch or arrival times yet, so this is the closest
measure available; the API says so in `methodology`.

GET /api/analytics/performance/?year=2026&month=03&barangay=Cotta&incident_type=RCA&severity=high
"""
from datetime import datetime, timedelta
from statistics import median

ON_TIME_MINUTES = 30
MAX_VALID_MINUTES = 24 * 60
RESOLVED_STATUSES = {'resolved', 'contained', 'false_alarm'}
SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low']

# Score weights (out of 100). Speed is left out for teams without any measured time.
WEIGHT_SPEED = 40
WEIGHT_ON_TIME = 20
WEIGHT_RESOLUTION = 40
SPEED_BEST_MINUTES = 15   # 100 points at or below this
SPEED_WORST_MINUTES = 120  # 0 points at or above this


# ---------------------------------------------------------------------------
# Pure helpers (no database), easy to test
# ---------------------------------------------------------------------------

def report_minutes(occurred_time, created_at):
    """
    Minutes from the time the incident happened to when the report was filed.

    `occurred_time` is a local time of day; `created_at` is a local datetime. When the time of
    day is later than the filing time, the incident happened the day before. Returns None when
    either is missing or the gap is over a day.
    """
    if occurred_time is None or created_at is None:
        return None
    occurred_at = datetime.combine(created_at.date(), occurred_time)
    if created_at.tzinfo is not None:
        occurred_at = occurred_at.replace(tzinfo=created_at.tzinfo)
    if occurred_at > created_at:
        occurred_at -= timedelta(days=1)
    minutes = (created_at - occurred_at).total_seconds() / 60
    return round(minutes, 1) if 0 <= minutes <= MAX_VALID_MINUTES else None


def is_resolved(incident_status):
    return str(incident_status or '').lower() in RESOLVED_STATUSES


def percent(part, whole):
    return round(part / whole * 100, 1) if whole else 0.0


def speed_points(average_minutes):
    if average_minutes is None:
        return None
    if average_minutes <= SPEED_BEST_MINUTES:
        return 100.0
    if average_minutes >= SPEED_WORST_MINUTES:
        return 0.0
    span = SPEED_WORST_MINUTES - SPEED_BEST_MINUTES
    return round(100 * (SPEED_WORST_MINUTES - average_minutes) / span, 1)


def performance_score(average_minutes, on_time_rate, resolution_rate):
    """Weighted score out of 100. Without measured times, only the resolution rate counts."""
    speed = speed_points(average_minutes)
    if speed is None:
        return round(resolution_rate, 1), {'speed': None, 'on_time': None, 'resolution': resolution_rate}
    total = (speed * WEIGHT_SPEED + on_time_rate * WEIGHT_ON_TIME + resolution_rate * WEIGHT_RESOLUTION) / (
        WEIGHT_SPEED + WEIGHT_ON_TIME + WEIGHT_RESOLUTION
    )
    return round(total, 1), {'speed': speed, 'on_time': on_time_rate, 'resolution': resolution_rate}


def summarize(rows):
    """
    Totals for a group of rows. Each row is a dict with: minutes (float or None),
    resolved (bool), severity (str or None), victims (int), first_action_minutes (float or None).
    """
    measured = [row['minutes'] for row in rows if row['minutes'] is not None]
    first_actions = [row['first_action_minutes'] for row in rows if row.get('first_action_minutes') is not None]
    resolved = sum(1 for row in rows if row['resolved'])
    on_time = sum(1 for minutes in measured if minutes <= ON_TIME_MINUTES)
    average = round(sum(measured) / len(measured), 1) if measured else None
    resolution_rate = percent(resolved, len(rows))
    on_time_rate = percent(on_time, len(measured))
    score, parts = performance_score(average, on_time_rate, resolution_rate)

    return {
        'assignments': len(rows),
        'resolved': resolved,
        'resolution_rate': resolution_rate,
        'measured': len(measured),
        'average_minutes': average,
        'median_minutes': round(median(measured), 1) if measured else None,
        'fastest_minutes': min(measured) if measured else None,
        'slowest_minutes': max(measured) if measured else None,
        'on_time': on_time,
        'on_time_rate': on_time_rate,
        'high_priority': sum(1 for row in rows if row['severity'] in ('critical', 'high')),
        'victims': sum(row['victims'] for row in rows),
        'average_first_action_minutes': round(sum(first_actions) / len(first_actions), 1) if first_actions else None,
        'score': score,
        'score_parts': parts,
    }


def build_performance(rows):
    """Overall, per team, per severity and per incident type figures from the rows."""
    teams = {}
    severities = {}
    types = {}
    for row in rows:
        teams.setdefault(row['team'], []).append(row)
        severities.setdefault(row['severity'] or 'unknown', []).append(row)
        types.setdefault(row['incident_type'], []).append(row)

    team_list = [{'team': team, **summarize(team_rows)} for team, team_rows in teams.items()]
    team_list.sort(key=lambda item: (-item['score'], -item['assignments'], item['team']))

    severity_list = [
        {'severity': severity, **summarize(severity_rows)}
        for severity, severity_rows in sorted(
            severities.items(),
            key=lambda item: SEVERITY_ORDER.index(item[0]) if item[0] in SEVERITY_ORDER else len(SEVERITY_ORDER),
        )
    ]
    type_list = sorted(
        ({'incident_type': incident_type, **summarize(type_rows)} for incident_type, type_rows in types.items()),
        key=lambda item: -item['assignments'],
    )

    return {
        'overall': summarize(rows),
        'teams': team_list,
        'by_severity': severity_list,
        'by_incident_type': type_list,
    }


# ---------------------------------------------------------------------------
# Database part
# ---------------------------------------------------------------------------

def _approved_reports(filters):
    from django.db.models import Q
    from incidents.models import IncidentReport

    queryset = IncidentReport.objects.filter(status__istartswith='approv').select_related('barangay')

    year = filters.get('year')
    month = filters.get('month')
    if year:
        queryset = queryset.filter(created_at__year=int(year))
        if month:
            queryset = queryset.filter(created_at__month=int(month))

    barangay = (filters.get('barangay') or '').strip()
    if barangay:
        name = barangay[len('barangay '):] if barangay.lower().startswith('barangay ') else barangay
        queryset = queryset.filter(Q(barangay__name__iexact=name) | Q(location__icontains=name))

    incident_types = [value.strip() for value in (filters.get('incident_type') or '').split(',') if value.strip()]
    if incident_types:
        type_filter = Q()
        for incident_type in incident_types:
            type_filter |= Q(incident_type__iexact=incident_type)
        queryset = queryset.filter(type_filter)

    team = (filters.get('team') or '').strip()
    if team:
        queryset = queryset.filter(responder_team__iexact=team)

    return queryset


def collect_rows(filters=None):
    """One row per approved report that matches the filters."""
    from django.utils import timezone
    from incidents.models import Incident

    filters = filters or {}
    reports = list(_approved_reports(filters))
    codes = [report.incident_code for report in reports if report.incident_code]

    incidents = {
        incident.reference_code.upper(): incident
        for incident in Incident.objects.filter(reference_code__in=codes).prefetch_related('responder_reports')
    }

    wanted_severity = (filters.get('severity') or '').strip().lower()
    rows = []
    for report in reports:
        incident = incidents.get((report.incident_code or '').upper())
        severity = incident.severity_level if incident else None
        if wanted_severity and severity != wanted_severity:
            continue

        first_action_minutes = None
        if incident is not None:
            actions = sorted(incident.responder_reports.all(), key=lambda action: action.report_time)
            if actions:
                minutes = (actions[0].report_time - incident.date_reported).total_seconds() / 60
                if 0 <= minutes <= MAX_VALID_MINUTES:
                    first_action_minutes = round(minutes, 1)

        created_at = timezone.localtime(report.created_at) if report.created_at else None
        rows.append({
            'team': (report.responder_team or '').strip() or 'Unassigned',
            'incident_type': report.incident_type,
            'severity': severity,
            'resolved': is_resolved(incident.status if incident else None),
            'victims': report.victim_count or 0,
            'minutes': report_minutes(report.time_occurred, created_at),
            'first_action_minutes': first_action_minutes,
        })
    return rows


def get_response_performance_metrics(filters=None):
    filters = filters or {}
    result = build_performance(collect_rows(filters))
    overall = result['overall']

    return {
        **result,
        'filters': {key: value for key, value in filters.items() if value},
        'methodology': {
            'response_time': (
                'Minutes from the time the incident happened to when the responder filed the report. '
                'Dispatch and arrival times are not recorded yet.'
            ),
            'on_time_minutes': ON_TIME_MINUTES,
            'resolved_statuses': sorted(RESOLVED_STATUSES),
            'score': (
                f'Speed {WEIGHT_SPEED}% (100 points at {SPEED_BEST_MINUTES} min or less, 0 at {SPEED_WORST_MINUTES} min), '
                f'on-time rate {WEIGHT_ON_TIME}%, resolution rate {WEIGHT_RESOLUTION}%. '
                'Teams without measured times are scored on resolution rate only.'
            ),
        },
        # Keys from the first version of this endpoint, kept for existing callers.
        'overall_metrics': {
            'total_incidents': overall['assignments'],
            'resolved_incidents': overall['resolved'],
            'resolution_rate_percent': overall['resolution_rate'],
            'average_response_time_minutes': overall['average_minutes'] or 0.0,
        },
        'team_workload': [{'team': team['team'], 'cases_handled': team['assignments']} for team in result['teams']],
        'performance_by_severity': [
            {
                'severity': item['severity'],
                'total_incidents': item['assignments'],
                'resolved': item['resolved'],
                'resolution_rate': item['resolution_rate'],
            }
            for item in result['by_severity']
        ],
    }