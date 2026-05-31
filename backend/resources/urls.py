from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupplyCategoryViewSet, SupplyViewSet,
    EvacuationCenterViewSet, EquipmentViewSet,
    VolunteerViewSet, ResourcesSummaryViewSet,
    import_evacuation_centers_csv  # 1. Import the function
)

router = DefaultRouter()
router.register(r'supply-categories', SupplyCategoryViewSet, basename='supply-category')
router.register(r'supplies', SupplyViewSet, basename='supply')
router.register(r'evacuation-centers', EvacuationCenterViewSet, basename='evacuation-center')
router.register(r'equipment', EquipmentViewSet, basename='equipment')
router.register(r'volunteers', VolunteerViewSet, basename='volunteer')
router.register(r'summary', ResourcesSummaryViewSet, basename='resources-summary')

urlpatterns = [
    # 2. CUSTOM PATH MUST COME FIRST to avoid router conflict
    path('evacuation-centers/import-csv/', import_evacuation_centers_csv, name='import-evacuation-csv'),
    
    # 3. Router URLs come after
    path('', include(router.urls)),
]