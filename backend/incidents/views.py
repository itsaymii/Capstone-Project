from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from django.db.models import Count, Q
from .models import HazardType, Incident, Alert, ResponderReport
from .serializers import (
    HazardTypeSerializer, IncidentSerializer,
    AlertSerializer, ResponderReportSerializer
)
from accounts.permissions import IsStaffOrReadOnly
import re


class HazardTypeViewSet(viewsets.ModelViewSet):
    queryset = HazardType.objects.all()
    serializer_class = HazardTypeSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    search_fields = ['name', 'description']
    ordering_fields = ['name']


class IncidentViewSet(viewsets.ModelViewSet):
    serializer_class = IncidentSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['description', 'address', 'hazard_type__name', 'reference_code']
    ordering_fields = ['incident_datetime', 'severity_level', 'status']
    
    def get_queryset(self):
        queryset = Incident.objects.select_related(
            'hazard_type', 'barangay', 'reported_by'
        ).prefetch_related(
            'fire_details', 'earthquake_details', 'vehicular_accident_details',
            'crime_details', 'medical_details', 'drowning_details'
        ).all()
        
        status_filter = self.request.query_params.get('status')
        if status_filter: 
            queryset = queryset.filter(status=status_filter)
        
        severity = self.request.query_params.get('severity')
        if severity: 
            queryset = queryset.filter(severity_level=severity)
        
        hazard_type = self.request.query_params.get('hazard_type')
        if hazard_type: 
            queryset = queryset.filter(hazard_type_id=hazard_type)
        
        barangay = self.request.query_params.get('barangay')
        if barangay: 
            queryset = queryset.filter(barangay_id=barangay)
        
        # ✅ Filter by reference_code (INC-YYYY-NNN)
        reference_code = self.request.query_params.get('reference_code')
        if reference_code:
            normalized = reference_code.upper().strip()
            if re.match(r'^INC-\d{4}-\d{3}$', normalized):
                queryset = queryset.filter(reference_code=normalized)
        
        return queryset.order_by('-incident_datetime')
    
    @action(detail=False, methods=['get'])
    def by_status(self, request):
        stats = Incident.objects.values('status').annotate(count=Count('id'))
        return Response({item['status']: item['count'] for item in stats})
    
    @action(detail=False, methods=['get'])
    def by_hazard_type(self, request):
        stats = Incident.objects.values('hazard_type__id', 'hazard_type__name').annotate(count=Count('id')).order_by('-count')
        return Response([{
            "hazard_type_id": str(item['hazard_type__id']),
            "hazard_type_name": item['hazard_type__name'],
            "count": item['count'],
        } for item in stats])
    
    # ✅ NEW: Quick lookup by reference_code
    @action(detail=False, methods=['get'], url_path='lookup/(?P<reference_code>[^/.]+)')
    def lookup_by_reference(self, request, reference_code=None):
        """GET /incidents/lookup/INC-2025-001/"""
        normalized = reference_code.upper().strip() if reference_code else ""
        if not re.match(r'^INC-\d{4}-\d{3}$', normalized):
            return Response(
                {"error": "Invalid format. Use INC-YYYY-NNN"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            incident = Incident.objects.get(reference_code=normalized)
            serializer = self.get_serializer(incident)
            return Response(serializer.data)
        except Incident.DoesNotExist:
            return Response(
                {"error": f"Incident '{normalized}' not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.select_related('incident').filter(is_active=True).all()
    serializer_class = AlertSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        is_active = self.request.query_params.get('is_active', 'true')
        if is_active.lower() == 'true': 
            queryset = queryset.filter(is_active=True)
        return queryset.order_by('-sent_at')


class ResponderReportViewSet(viewsets.ModelViewSet):
    """
    ✅ Now accepts incident_reference_code (INC-1001) instead of UUID
    POST body example:
    {
        "incident_reference_code": "INC-2025-001",
        "report_text": "First aid rendered...",
        "action_taken": "Transported to hospital",
        "status_update": "resolved"
    }
    """
    queryset = ResponderReport.objects.select_related('incident', 'responder').all().order_by('-report_time')
    serializer_class = ResponderReportSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    
    def perform_create(self, serializer):
        serializer.save(responder=self.request.user)
    
    # ✅ Optional: Override create to add custom error handling
    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            # Log error and return user-friendly message
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Report submission error: {str(e)}")
            return Response(
                {"error": "Failed to submit report. Please verify incident code and try again."},
                status=status.HTTP_400_BAD_REQUEST
            )