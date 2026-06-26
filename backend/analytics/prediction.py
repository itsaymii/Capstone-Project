# analytics/prediction.py
def predict_top_hazard(barangay_id, days=90, start_date=None, end_date=None):
    """
    Predicts the most probable hazard to reoccur in the next 30 days.
    
    Logic:
    1. Uses combined_score (frequency × severity_weight) from aggregators
    2. Ranks hazards by score
    3. Calculates confidence based on margin between #1 and #2 hazards
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
            'confidence': 'Low',
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
    
    # Calculate confidence margin
    if len(sorted_hazards) > 1:
        second_data = sorted_hazards[1][1]
        margin = top_data['combined_score'] - second_data['combined_score']
        
        # If top hazard dominates by >50% margin, confidence is High
        confidence = 'High' if margin > (top_data['combined_score'] * 0.5) else 'Medium'
    else:
        confidence = 'High'  # Only one hazard type present
    
    return {
        'hazard': top_hazard_name,
        'hazard_id': top_data.get('id'),
        'confidence': confidence,
        'driver': f"{top_data['frequency']} incidents (avg severity: {top_data['severity_weight']})",
        'prediction_window_days': 30
    }