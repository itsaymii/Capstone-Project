from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from analytics.insights import generate_strategic_dashboard_briefing
from incidents.models import Incident
from .models import DashboardInsightCache


CACHE_KEY = 'strategic-quarterly-briefing'
WINDOW_DAYS = 30
REFRESH_INTERVAL = timedelta(days=30)
REFRESH_LEASE = timedelta(minutes=1)
SEVERITY_LEVELS = ('low', 'moderate', 'high', 'critical')


class BriefingRefreshInProgress(Exception):
    pass


def _build_dashboard_stats(window_end):
    window_start = window_end - timedelta(days=WINDOW_DAYS)
    incidents = Incident.objects.filter(
        incident_datetime__gte=window_start,
        incident_datetime__lte=window_end,
    )
    total = incidents.count()
    by_severity = {level: 0 for level in SEVERITY_LEVELS}
    by_severity.update({
        row['severity_level']: row['count']
        for row in incidents.values('severity_level').annotate(count=Count('id'))
        if row['severity_level'] in by_severity
    })
    high_critical = by_severity['high'] + by_severity['critical']
    hotspots = list(
        incidents
        .filter(barangay__isnull=False)
        .values('barangay__name')
        .annotate(count=Count('id'))
        .order_by('-count', 'barangay__name')[:3]
    )
    return window_start, {
        'total': total,
        'monthly_average': round(total * (30 / WINDOW_DAYS), 1),
        'high_critical_count': high_critical,
        'high_critical_percentage': round(high_critical / total * 100, 1) if total else 0,
        'by_severity': by_severity,
        'hotspots': [
            {'name': row['barangay__name'], 'count': row['count']}
            for row in hotspots
        ],
    }


def _serialize_cache(cache):
    generated_at = cache.generated_at
    return {
        'generated_at': generated_at.isoformat(),
        'refreshes_at': (generated_at + REFRESH_INTERVAL).isoformat(),
        'window': {
            'start': cache.window_start.isoformat(),
            'end': cache.window_end.isoformat(),
            'days': WINDOW_DAYS,
        },
        'stats': cache.stats,
        'briefing': cache.briefing,
    }


def get_strategic_dashboard_briefing():
    now = timezone.now()
    DashboardInsightCache.objects.get_or_create(key=CACHE_KEY)
    cache = DashboardInsightCache.objects.get(key=CACHE_KEY)

    if cache.generated_at and now < cache.generated_at + REFRESH_INTERVAL:
        return _serialize_cache(cache)

    claimed = DashboardInsightCache.objects.filter(key=CACHE_KEY).filter(
        Q(generated_at__isnull=True) | Q(generated_at__lte=now - REFRESH_INTERVAL),
        Q(refresh_started_at__isnull=True) | Q(refresh_started_at__lte=now - REFRESH_LEASE),
    ).update(refresh_started_at=now)
    if not claimed:
        cache = DashboardInsightCache.objects.get(key=CACHE_KEY)
        if cache.generated_at and now < cache.generated_at + REFRESH_INTERVAL:
            return _serialize_cache(cache)
        raise BriefingRefreshInProgress

    try:
        window_start, stats = _build_dashboard_stats(now)
        briefing = generate_strategic_dashboard_briefing(stats)

        cache.window_start = window_start
        cache.window_end = now
        cache.generated_at = now
        cache.refresh_started_at = None
        cache.stats = stats
        cache.briefing = briefing
        cache.save(update_fields=[
            'window_start', 'window_end', 'generated_at', 'refresh_started_at', 'stats', 'briefing',
        ])
    except Exception:
        DashboardInsightCache.objects.filter(
            key=CACHE_KEY,
            refresh_started_at=now,
        ).update(refresh_started_at=None)
        raise

    return _serialize_cache(cache)
