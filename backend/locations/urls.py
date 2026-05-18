from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BarangayViewSet, LocationViewSet,
    PopulationDensityViewSet, EarthquakeFaultLineViewSet
)

router = DefaultRouter()
router.register(r'barangays', BarangayViewSet, basename='barangay')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'population-density', PopulationDensityViewSet, basename='population-density')
router.register(r'fault-lines', EarthquakeFaultLineViewSet, basename='fault-line')

urlpatterns = [
    path('', include(router.urls)),
]