# analytics/prediction.py
def predict_top_hazard(barangay_id, days=90, start_date=None, end_date=None):
    """
    Predicts the most probable hazard to reoccur in the next 30 days.
    Returns an actual probability percentage based on historical dominance.
    """
    from .aggregators import get_barangay_profile
    
    profile = get_barangay_profile(
        barangay_id,
        days=days,
        start_date=start_date,
        end_date=end_date,
    )
    
    # Edge case: No recent incidents
    if not profile['hazards']:
        return {
            'hazard': None,
            'hazard_id': None,
            'probability': 0.0,
            'confidence': 'None',
            'reason': 'No incidents in this period to base a prediction on.',
            'driver': 'N/A',
            'prediction_window_days': 30
        }
    
    # Sort hazards by combined_score (descending)
    sorted_hazards = sorted(
        profile['hazards'].items(),
        key=lambda x: x[1]['combined_score'],
        reverse=True
    )
    
    top_hazard_name, top_data = sorted_hazards[0]
    
    # ✅ NEW: Calculate actual probability percentage
    # The probability is the top hazard's share of the total risk score
    total_score = sum(hazard_data['combined_score'] for _, hazard_data in profile['hazards'].items())
    
    if total_score > 0:
        probability = round((top_data['combined_score'] / total_score) * 100, 1)
    else:
        probability = 0.0
    
    # Confidence grows with both the hazard's share of the risk and how many incidents back it.
    frequency = top_data['frequency']
    if probability >= 60 and frequency >= 5:
        confidence = 'High'
    elif probability >= 35 and frequency >= 3:
        confidence = 'Medium'
    else:
        confidence = 'Low'

    others = len(sorted_hazards) - 1
    reason = (
        f"{top_hazard_name} accounts for {probability}% of this barangay's weighted incident risk "
        f"({frequency} incident{'s' if frequency != 1 else ''}, average severity {top_data['severity_weight']} of 4)"
        + (f", ahead of {others} other hazard type{'s' if others != 1 else ''}." if others else ', the only hazard recorded.')
    )

    return {
        'hazard': top_hazard_name,
        'hazard_id': top_data.get('id'),
        'probability': probability,
        'confidence': confidence,
        'reason': reason,
        'driver': f"{frequency} incidents (avg severity: {top_data['severity_weight']})",
        'prediction_window_days': 30
    }