# analytics/views.py
from datetime import datetime, time, timedelta
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from incidents.models import Incident
from .aggregators import get_barangay_profile, get_hazard_citywide_stats, get_incident_trend_comparison
from .scoring import calculate_risk_score
from .prediction import predict_top_hazard
from .insights import generate_hazard_insight


def build_score_history(barangay_id, window_days=30, points=6):
    now = timezone.now()
    history = []
    for index in range(points):
        end_date = now - timedelta(days=(points - 1 - index) * window_days)
        start_date = end_date - timedelta(days=window_days)
        score_data = calculate_risk_score(barangay_id, start_date=start_date, end_date=end_date)
        history.append({
            'date': end_date.date().isoformat(),
            'score': score_data['score'],
            'frequency': score_data['breakdown']['frequency'],
            'severity': score_data['breakdown']['severity'],
            'recency': score_data['breakdown']['recency'],
        })
    return history


def normalize_datetime_range(start_date, end_date):
    if not isinstance(start_date, datetime):
        start_date = datetime.combine(start_date, time.min)
    if not isinstance(end_date, datetime):
        end_date = datetime.combine(end_date, time.max)

    if timezone.is_naive(start_date):
        start_date = timezone.make_aware(start_date)
    if timezone.is_naive(end_date):
        end_date = timezone.make_aware(end_date)

    return start_date, end_date


def resolve_year_month_range(year, month=None):
    start = datetime(year, month or 1, 1)
    if month:
        if month == 12:
            end = datetime(year + 1, 1, 1)
        else:
            end = datetime(year, month + 1, 1)
    else:
        end = datetime(year + 1, 1, 1)

    if timezone.is_naive(start):
        start = timezone.make_aware(start)
    if timezone.is_naive(end):
        end = timezone.make_aware(end)

    # Existing aggregations use an inclusive end date.
    inclusive_end = end - timedelta(microseconds=1)
    return start, inclusive_end


def parse_year_month_params(request):
    year_str = request.query_params.get('year')
    month_str = request.query_params.get('month')
    compare_year_str = request.query_params.get('compare_year')
    compare_month_str = request.query_params.get('compare_month')

    if month_str and not year_str:
        return None, Response({'error': 'month requires year.'}, status=status.HTTP_400_BAD_REQUEST)

    if compare_month_str and not compare_year_str:
        return None, Response({'error': 'compare_month requires compare_year.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        year = int(year_str) if year_str else None
        month = int(month_str) if month_str else None
        compare_year = int(compare_year_str) if compare_year_str else None
        compare_month = int(compare_month_str) if compare_month_str else None
    except ValueError:
        return None, Response(
            {'error': 'year, month, compare_year, and compare_month must be integers.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if month is not None and (month < 1 or month > 12):
        return None, Response({'error': 'month must be between 1 and 12.'}, status=status.HTTP_400_BAD_REQUEST)

    if compare_month is not None and (compare_month < 1 or compare_month > 12):
        return None, Response({'error': 'compare_month must be between 1 and 12.'}, status=status.HTTP_400_BAD_REQUEST)

    return {
        'year': year,
        'month': month,
        'compare_year': compare_year,
        'compare_month': compare_month,
        'has_year_filter': bool(year_str),
    }, None


def build_incident_trend(barangay_id, days=90, buckets=9, start_date=None, end_date=None):
    if start_date and end_date:
        window_start, window_end = normalize_datetime_range(start_date, end_date)
    else:
        window_end = timezone.now()
        window_start = window_end - timedelta(days=days)

    total_span_days = max(1, (window_end - window_start).days)
    interval_days = max(1, total_span_days // buckets)
    trend = []

    for index in range(buckets):
        bucket_start = window_start + timedelta(days=index * interval_days)
        bucket_end = bucket_start + timedelta(days=interval_days)
        if bucket_end > window_end:
            bucket_end = window_end

        count = Incident.objects.filter(
            barangay_id=barangay_id,
            incident_datetime__gte=bucket_start,
            incident_datetime__lt=bucket_end,
        ).count()

        trend.append({
            'date': bucket_end.date().isoformat(),
            'count': count,
        })

    return trend


def build_hazard_share(profile):
    hazards = profile.get('hazards', {}) if profile else {}
    total_score = sum(item['combined_score'] for item in hazards.values())
    if total_score <= 0:
        return []

    return [
        {
            'hazard': hazard_name,
            'frequency': item['frequency'],
            'combined_score': item['combined_score'],
            'share': round((item['combined_score'] / total_score) * 100, 1),
        }
        for hazard_name, item in hazards.items()
    ]


@api_view(['GET'])
@permission_classes([AllowAny]) # Allow frontend to fetch without complex auth for now
def barangay_risk_view(request):
    """
    Endpoint 1: Calculates Risk Score (Phase 3) and Hazard Prediction (Phase 4).
    Params: barangay_id (required), days (optional, default 90)
    """
    barangay_id = request.query_params.get('barangay_id')
    if not barangay_id:
        return Response({'error': 'barangay_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        days = int(request.query_params.get('days', 90))
    except ValueError:
        return Response({'error': 'days must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

    start_date_str = request.query_params.get('start_date')
    end_date_str = request.query_params.get('end_date')
    year_params, year_param_error = parse_year_month_params(request)
    if year_param_error:
        return year_param_error

    year = year_params['year']
    month = year_params['month']
    compare_year = year_params['compare_year']
    compare_month = year_params['compare_month']

    if (start_date_str or end_date_str) and year_params['has_year_filter']:
        return Response(
            {'error': 'Use either start_date/end_date or year/month filters, not both.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    start_date = parse_date(start_date_str) if start_date_str else None
    end_date = parse_date(end_date_str) if end_date_str else None

    if (start_date_str or end_date_str) and not (start_date and end_date):
        return Response(
            {'error': 'Both start_date and end_date must be valid YYYY-MM-DD values when using a custom range.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if start_date and end_date and start_date > end_date:
        return Response(
            {'error': 'start_date must be earlier than or equal to end_date.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if start_date and end_date:
        start_date, end_date = normalize_datetime_range(start_date, end_date)
    elif year:
        start_date, end_date = resolve_year_month_range(year, month)

    # 1. Build barangay profile for risk scoring and hazard breakdown
    profile = get_barangay_profile(barangay_id, days=days, start_date=start_date, end_date=end_date)

    # 2. Calculate Risk Score
    risk_data = calculate_risk_score(barangay_id, days=days, start_date=start_date, end_date=end_date)

    # 3. Calculate Prediction
    prediction_data = predict_top_hazard(barangay_id, days=days, start_date=start_date, end_date=end_date)

    score_history = build_score_history(barangay_id, window_days=30, points=6)
    incident_trend = build_incident_trend(barangay_id, days=days, start_date=start_date, end_date=end_date, buckets=9)
    incident_trend_comparison = get_incident_trend_comparison(
        barangay_id=barangay_id,
        year=year,
        month=month,
        compare_year=compare_year,
        compare_month=compare_month,
    )
    hazard_share = build_hazard_share(profile)

    # 4. Return combined tactical intelligence
    return Response({
        'barangay_id': barangay_id,
        'timeframe_days': days,
        'risk_score': risk_data,
        'hazard_prediction': prediction_data,
        'barangay_profile': profile,
        'score_history': score_history,
        'incident_trend': incident_trend,
        'daily_incident_reports': incident_trend_comparison['current_period']['daily_reports'],
        'incident_trend_comparison': incident_trend_comparison,
        'hazard_share': hazard_share,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def hazard_insights_view(request):
    """
    Endpoint 2: Generates AI/Template Insights (Phase 5).
    Params: hazard (required), days (optional, default 365), 
            start_date (optional, YYYY-MM-DD), end_date (optional, YYYY-MM-DD)
    """
    hazard_name = request.query_params.get('hazard')
    if not hazard_name:
        return Response({'error': 'hazard query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        days = int(request.query_params.get('days', 365))
    except ValueError:
        return Response({'error': 'days must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

    # Parse custom date ranges if provided
    start_date_str = request.query_params.get('start_date')
    end_date_str = request.query_params.get('end_date')
    
    start_date = parse_date(start_date_str) if start_date_str else None
    end_date = parse_date(end_date_str) if end_date_str else None

    # 1. Get Aggregated Stats
    stats = get_hazard_citywide_stats(
        hazard_name, 
        days=days, 
        start_date=start_date, 
        end_date=end_date
    )

    # 2. Generate Insight
    insight_text = generate_hazard_insight(
        hazard_name, 
        stats, 
        days=days, 
        start_date=start_date, 
        end_date=end_date
    )

    # 3. Return strategic intelligence
    return Response({
        'hazard': hazard_name,
        'timeframe': {
            'rolling_days': days if not start_date else None,
            'start_date': start_date_str,
            'end_date': end_date_str
        },
        'raw_stats': stats,
        'ai_insight': insight_text
    })