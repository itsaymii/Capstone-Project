from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    HazardTypeViewSet, IncidentViewSet,
    AlertViewSet, ResponderReportViewSet
)

router = DefaultRouter()
router.register(r'hazard-types', HazardTypeViewSet, basename='hazard-type')
router.register(r'incidents', IncidentViewSet, basename='incident')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'responder-reports', ResponderReportViewSet, basename='responder-report')

urlpatterns = [
    path('', include(router.urls)),
]