from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from .models import Barangay, Location, EarthquakeFaultLine


@require_http_methods(["GET"])
def get_barangays_geojson(request):
    """Serve all barangays as GeoJSON"""
    barangays = Barangay.objects.all()
    
    features = []
    for b in barangays:
        if b.boundary:
            features.append({
                "type": "Feature",
                "properties": {
                    "id": str(b.id),
                    "name": b.name,
                    "city": b.city,
                    "province": b.province,
                    "population": b.population,
                    "brgy_code": b.brgy_code,
                },
                "geometry": b.boundary
            })
    
    return JsonResponse({
        "type": "FeatureCollection",
        "features": features
    })


@require_http_methods(["GET"])
def get_locations(request):
    """Serve all incident locations as JSON"""
    locations = Location.objects.all()
    
    data = [{
        "id": str(loc.id),
        "address": loc.address,
        "coordinates": loc.get_coordinates(),
        "barangay": loc.barangay.name if loc.barangay else None
    } for loc in locations]
    
    return JsonResponse({"locations": data})


@require_http_methods(["GET"])
def get_fault_lines(request):
    """Serve earthquake fault lines as GeoJSON"""
    fault_lines = EarthquakeFaultLine.objects.all()
    
    features = []
    for fl in fault_lines:
        features.append({
            "type": "Feature",
            "properties": {
                "id": str(fl.id),
                "name": fl.name,
            },
            "geometry": fl.coordinates
        })
    
    return JsonResponse({
        "type": "FeatureCollection",
        "features": features
    })