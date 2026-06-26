# analytics/scoring.py
from django.db.models import Count
from django.utils import timezone
from incidents.models import Incident
from datetime import timedelta

# Configuration: Weights for the risk score calculation
# These can be adjusted later for capstone tuning
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

    Logic:
    1. Frequency (40%): How many incidents in the selected period.
    2. Severity (40%): Average severity of those incidents.
    3. Recency (20%): Percentage of incidents in the last 30 days.
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
            }
        }

    # --- COMPONENT 1: FREQUENCY SCORE (0-10) ---
    # Scaling: 5 incidents = 1.0, 50+ incidents = 10.0
    freq_score = min(10.0, total / 5.0)

    # --- COMPONENT 2: SEVERITY SCORE (0-10) ---
    # Calculate weighted average severity
    sev_data = incidents.values('severity_level').annotate(count=Count('id'))
    
    weighted_sum = sum(
        SEVERITY_MAP.get(row['severity_level'], 1) * row['count'] 
        for row in sev_data
    )
    
    # Normalize: (Weighted Sum / Max Possible Sum) * 10
    # Max possible sum is (Total Incidents * Max Weight [4])
    max_possible = total * 4
    sev_score = (weighted_sum / max_possible) * 10.0

    # --- COMPONENT 3: RECENCY SCORE (0-10) ---
    # How "fresh" is the danger? (Last 30 days vs Total 90 days)
    recent_cutoff = timezone.now() - timedelta(days=30)
    recent_count = incidents.filter(incident_datetime__gte=recent_cutoff).count()
    
    # Ratio: 0% recent = 0.0 score, 100% recent = 10.0 score
    recency_score = (recent_count / total) * 10.0

    # --- FINAL CALCULATION ---
    raw_score = (
        (WEIGHTS['frequency'] * freq_score) +
        (WEIGHTS['severity'] * sev_score) +
        (WEIGHTS['recency'] * recency_score)
    )
    
    # Clamp result between 1.0 and 10.0
    final_score = round(max(1.0, min(10.0, raw_score)), 1)
    
    return {
        'score': final_score,
        'breakdown': {
            'frequency': round(freq_score, 1),
            'severity': round(sev_score, 1),
            'recency': round(recency_score, 1)
        }
    }