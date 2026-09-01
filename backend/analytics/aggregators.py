# analytics/aggregators.py
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from incidents.models import Incident
from datetime import timedelta, datetime

SEVERITY_MAP = {'low': 1, 'moderate': 2, 'high': 3, 'critical': 4}


def _to_aware_datetime(value):
    if timezone.is_naive(value):
        return timezone.make_aware(value)
    return value


def _resolve_period_bounds(year, month=None):
    if month:
        start = datetime(year, month, 1)
        if month == 12:
            end = datetime(year + 1, 1, 1)
        else:
            end = datetime(year, month + 1, 1)
    else:
        start = datetime(year, 1, 1)
        end = datetime(year + 1, 1, 1)

    return _to_aware_datetime(start), _to_aware_datetime(end)


def _build_daily_counts(queryset, start_dt, end_dt):
    grouped = (
        queryset
        .filter(incident_datetime__gte=start_dt, incident_datetime__lt=end_dt)
        .annotate(day=TruncDate('incident_datetime'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )

    count_by_day = {row['day']: row['count'] for row in grouped}
    reports = []
    running_day = start_dt.date()
    end_day = (end_dt - timedelta(days=1)).date()
    total = 0

    while running_day <= end_day:
        day_count = int(count_by_day.get(running_day, 0))
        reports.append({
            'date': running_day.isoformat(),
            'count': day_count,
        })
        total += day_count
        running_day = running_day + timedelta(days=1)

    return reports, total


def _calculate_percentage_change(current_total, previous_total):
    if previous_total == 0:
        if current_total == 0:
            return 0.0
        return None
    return round(((current_total - previous_total) / previous_total) * 100, 2)


def get_incident_trend_comparison(barangay_id, year=None, month=None, compare_year=None, compare_month=None):
    """Build daily incident reports plus trend comparison between two periods."""
    now = timezone.now()
    target_year = int(year or now.year)
    target_month = int(month) if month else None

    if compare_year is None:
        baseline_year = target_year - 1
    else:
        baseline_year = int(compare_year)

    if target_month is not None:
        baseline_month = int(compare_month) if compare_month else target_month
    else:
        baseline_month = int(compare_month) if compare_month else None

    current_start, current_end = _resolve_period_bounds(target_year, target_month)
    previous_start, previous_end = _resolve_period_bounds(baseline_year, baseline_month)

    base_queryset = Incident.objects.filter(barangay_id=barangay_id)

    current_daily, current_total = _build_daily_counts(base_queryset, current_start, current_end)
    previous_daily, previous_total = _build_daily_counts(base_queryset, previous_start, previous_end)

    percent_change = _calculate_percentage_change(current_total, previous_total)
    if percent_change is None:
        trend_direction = 'increase' if current_total > 0 else 'flat'
    elif percent_change > 0:
        trend_direction = 'increase'
    elif percent_change < 0:
        trend_direction = 'decrease'
    else:
        trend_direction = 'flat'

    return {
        'current_period': {
            'year': target_year,
            'month': target_month,
            'start_date': current_start.date().isoformat(),
            'end_date': (current_end - timedelta(days=1)).date().isoformat(),
            'total': current_total,
            'daily_reports': current_daily,
        },
        'comparison_period': {
            'year': baseline_year,
            'month': baseline_month,
            'start_date': previous_start.date().isoformat(),
            'end_date': (previous_end - timedelta(days=1)).date().isoformat(),
            'total': previous_total,
            'daily_reports': previous_daily,
        },
        'trend': {
            'percent_change': percent_change,
            'direction': trend_direction,
            'current_total': current_total,
            'previous_total': previous_total,
        },
    }

def get_barangay_profile(barangay_id, days=90, start_date=None, end_date=None):
    """Return incident breakdown for one barangay"""
    # ✅ Support both rolling window AND custom date range
    if start_date and end_date:
        incidents = Incident.objects.filter(
            barangay_id=barangay_id,
            incident_datetime__gte=start_date,
            incident_datetime__lte=end_date
        )
    else:
        cutoff = timezone.now() - timedelta(days=days)
        incidents = Incident.objects.filter(
            barangay_id=barangay_id, 
            incident_datetime__gte=cutoff
        )
    
    if incidents.count() == 0:
        return {'total': 0, 'hazards': {}, 'top_hazard': None}
    
    hazard_rows = incidents.values('hazard_type__name', 'hazard_type_id').annotate(count=Count('id'))
    hazards = {}
    
    for row in hazard_rows:
        sev_data = incidents.filter(hazard_type_id=row['hazard_type_id']).values('severity_level').annotate(c=Count('id'))
        weighted = sum(SEVERITY_MAP.get(s['severity_level'], 1) * s['c'] for s in sev_data)
        avg_sev = weighted / row['count']
        
        hazards[row['hazard_type__name']] = {
            'id': row['hazard_type_id'],
            'frequency': row['count'],
            'severity_weight': round(avg_sev, 2),
            'combined_score': row['count'] * avg_sev
        }
    
    top = max(hazards.items(), key=lambda x: x[1]['combined_score'], default=(None, None))
    
    return {
        'total': incidents.count(),
        'hazards': hazards,
        'top_hazard': top[0]
    }

def get_hazard_citywide_stats(hazard_name, days=365, start_date=None, end_date=None):
    """Aggregate stats for one hazard type across all barangays"""
    # ✅ Support both rolling window AND custom date range
    if start_date and end_date:
        qs = Incident.objects.filter(
            hazard_type__name__iexact=hazard_name,
            incident_datetime__gte=start_date,
            incident_datetime__lte=end_date
        )
    else:
        cutoff = timezone.now() - timedelta(days=days)
        qs = Incident.objects.filter(
            hazard_type__name__iexact=hazard_name,
            incident_datetime__gte=cutoff
        )
    
    return {
        'total': qs.count(),
        'by_severity': {
            item['severity_level']: item['count']
            for item in qs.values('severity_level').annotate(count=Count('id'))
        },
        'by_barangay': {
            item['barangay__name']: item['count']
            for item in qs.values('barangay__name').annotate(count=Count('id')).order_by('-count')[:5]
        }
    }