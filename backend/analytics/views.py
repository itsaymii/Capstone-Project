# analytics/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils.dateparse import parse_date

from .aggregators import get_barangay_profile, get_hazard_citywide_stats
from .scoring import calculate_risk_score
from .prediction import predict_top_hazard
from .insights import generate_hazard_insight

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

    # 1. Calculate Risk Score
    risk_data = calculate_risk_score(barangay_id, days=days)

    # 2. Calculate Prediction
    prediction_data = predict_top_hazard(barangay_id, days=days)

    # 3. Return combined tactical intelligence
    return Response({
        'barangay_id': barangay_id,
        'timeframe_days': days,
        'risk_score': risk_data,
        'hazard_prediction': prediction_data
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