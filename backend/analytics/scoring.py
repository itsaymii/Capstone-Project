# analytics/scoring.py
from django.db.models import Count
from django.utils import timezone
from incidents.models import Incident
from datetime import timedelta

# Configuration: Weights for the risk score calculation
WEIGHTS = {
    'frequency': 0.4,
    'severity': 0.4,
    'recency': 0.2
}

# Mapping text severity to numerical weight (Low=1 to Critical=4)
SEVERITY_MAP = {
    'low': 1,
    'moderate': 2,
    'high': 3,
    'critical': 4
}

def calculate_risk_score(barangay_id, days=90, start_date=None, end_date=None):
    """
    Calculates a risk score (1.0 to 10.0) for a specific barangay.
    Returns the score, the normalized breakdown, and a detailed explanation.
    """

    if start_date is not None and end_date is not None:
        incidents = Incident.objects.filter(
            barangay_id=barangay_id,
            incident_datetime__gte=start_date,
            incident_datetime__lte=end_date,
        )
    else:
        cutoff = timezone.now() - timedelta(days=days)
        incidents = Incident.objects.filter(barangay_id=barangay_id, incident_datetime__gte=cutoff)
        
    total = incidents.count()
    
    # Edge case: No incidents = Minimum score
    if total == 0:
        return {
            'score': 1.0,
            'breakdown': {
                'frequency': 1.0,
                'severity': 1.0,
                'recency': 1.0,
            },
            # ✅ NEW: Explanation for empty state
            'explanation': {
                'total_incidents': 0,
                'average_severity_weight': 0.0,
                'recent_incidents_30_days': 0,
                'calculation_details': "No incidents recorded in this period. Minimum baseline score applied."
            }
        }

    # --- COMPONENT 1: FREQUENCY SCORE (0-10) ---
    freq_score = min(10.0, total / 5.0)

    # --- COMPONENT 2: SEVERITY SCORE (0-10) ---
    sev_data = incidents.values('severity_level').annotate(count=Count('id'))
    
    weighted_sum = sum(
        SEVERITY_MAP.get(row['severity_level'], 1) * row['count'] 
        for row in sev_data
    )
    
    max_possible = total * 4
    sev_score = (weighted_sum / max_possible) * 10.0
    
    # Calculate raw average severity weight for the explanation
    avg_severity_weight = weighted_sum / total

    # --- COMPONENT 3: RECENCY SCORE (0-10) ---
    recent_cutoff = timezone.now() - timedelta(days=30)
    recent_count = incidents.filter(incident_datetime__gte=recent_cutoff).count()
    
    recency_score = (recent_count / total) * 10.0

    # --- FINAL CALCULATION ---
    raw_score = (
        (WEIGHTS['frequency'] * freq_score) +
        (WEIGHTS['severity'] * sev_score) +
        (WEIGHTS['recency'] * recency_score)
    )
    
    final_score = round(max(1.0, min(10.0, raw_score)), 1)
    
    # Round scores for clean output
    f_score = round(freq_score, 1)
    s_score = round(sev_score, 1)
    r_score = round(recency_score, 1)

    return {
        'score': final_score,
        'breakdown': {
            'frequency': f_score,
            'severity': s_score,
            'recency': r_score
        },
        # ✅ NEW: Detailed explanation for the frontend to display
        'explanation': {
            'total_incidents': total,
            'average_severity_weight': round(avg_severity_weight, 2),
            'recent_incidents_30_days': recent_count,
            'calculation_details': f"Score = ({f_score} × 0.4) + ({s_score} × 0.4) + ({r_score} × 0.2) = {final_score}"
        }
    }