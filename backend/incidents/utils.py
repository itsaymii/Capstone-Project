# incidents/utils.py
import math
from locations.models import Barangay

def get_nearest_barangay(latitude, longitude, radius_km=5.0):
    """
    Finds the closest barangay within a radius (default 5km).
    Returns None if no barangay is found nearby.
    """
    if not latitude or not longitude:
        return None

    closest_brgy = None
    min_distance = radius_km

    for brgy in Barangay.objects.filter(latitude__isnull=False, longitude__isnull=False):
        # Haversine formula for distance in km
        R = 6371.0
        lat1, lon1 = math.radians(latitude), math.radians(longitude)
        lat2, lon2 = math.radians(float(brgy.latitude)), math.radians(float(brgy.longitude))
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c

        if distance < min_distance:
            min_distance = distance
            closest_brgy = brgy

    return closest_brgy