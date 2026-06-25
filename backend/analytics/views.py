# analytics/views.py
from datetime import timedelta
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from incidents.models import Incident
from .aggregators import get_barangay_profile, get_hazard_citywide_stats
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


def build_incident_trend(barangay_id, days=90, buckets=9):
    now = timezone.now()
    start_date = now - timedelta(days=days)
    interval_days = max(1, days // buckets)
    trend = []

    for index in range(buckets):
        bucket_start = start_date + timedelta(days=index * interval_days)
        bucket_end = bucket_start + timedelta(days=interval_days)
        if bucket_end > now:
            bucket_end = now

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

    # 1. Build barangay profile for risk scoring and hazard breakdown
    profile = get_barangay_profile(barangay_id, days=days)

    # 2. Calculate Risk Score
    risk_data = calculate_risk_score(barangay_id, days=days)

    # 3. Calculate Prediction
    prediction_data = predict_top_hazard(barangay_id, days=days)

    score_history = build_score_history(barangay_id, window_days=30, points=6)
    incident_trend = build_incident_trend(barangay_id, days=days, buckets=9)
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