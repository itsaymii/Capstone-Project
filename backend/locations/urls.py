from django.urls import path
from . import views as api

urlpatterns = [
    path('api/barangays/', api.get_barangays_geojson, name='api-barangays'),
    path('api/locations/', api.get_locations, name='api-locations'),
    path('api/fault-lines/', api.get_fault_lines, name='api-fault-lines'),
]