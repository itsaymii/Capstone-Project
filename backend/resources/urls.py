from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupplyCategoryViewSet, SupplyViewSet,
    EvacuationCenterViewSet, EquipmentViewSet,
    VolunteerViewSet, ResourcesSummaryViewSet
)

router = DefaultRouter()
router.register(r'supply-categories', SupplyCategoryViewSet, basename='supply-category')
router.register(r'supplies', SupplyViewSet, basename='supply')
router.register(r'evacuation-centers', EvacuationCenterViewSet, basename='evacuation-center')
router.register(r'equipment', EquipmentViewSet, basename='equipment')
router.register(r'volunteers', VolunteerViewSet, basename='volunteer')
router.register(r'summary', ResourcesSummaryViewSet, basename='resources-summary')

urlpatterns = [
    path('', include(router.urls)),
]