from django.db.models import Count
from django.utils import timezone
from incidents.models import Incident
from datetime import timedelta

SEVERITY_MAP = {'low': 1, 'moderate': 2, 'high': 3, 'critical': 4}

def get_barangay_profile(barangay_id, days=90):
    """Return incident breakdown for one barangay"""
    cutoff = timezone.now() - timedelta(days=days)
    incidents = Incident.objects.filter(barangay_id=barangay_id, incident_datetime__gte=cutoff)
    
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

def get_hazard_citywide_stats(hazard_name, days=365):
    """Aggregate stats for one hazard type across all barangays"""
    cutoff = timezone.now() - timedelta(days=days)
    qs = Incident.objects.filter(
        hazard_type__name__iexact=hazard_name,
        incident_datetime__gte=cutoff
    )
    return {
        'total': qs.count(),
        # ✅ FIX: Use dict comprehension to map {severity_level: count}
        'by_severity': {
            item['severity_level']: item['count']
            for item in qs.values('severity_level').annotate(count=Count('id'))
        },
        # ✅ FIX: Same for barangays
        'by_barangay': {
            item['barangay__name']: item['count']
            for item in qs.values('barangay__name').annotate(count=Count('id')).order_by('-count')[:5]
        }
    }