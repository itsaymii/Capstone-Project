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
            'probability': 0.0, # ✅ Changed from 'confidence': 'Low'
            'reason': 'No recent incidents to base prediction on.',
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
    
    return {
        'hazard': top_hazard_name,
        'hazard_id': top_data.get('id'),
        'probability': probability, # ✅ Returns a float like 75.5 instead of 'High'
        'driver': f"{top_data['frequency']} incidents (avg severity: {top_data['severity_weight']})",
        'prediction_window_days': 30
    }