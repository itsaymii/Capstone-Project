from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from django.db.models import Count
from .models import HazardType, Incident, Alert, ResponderReport
from .serializers import (
    HazardTypeSerializer, IncidentSerializer,
    AlertSerializer, ResponderReportSerializer
)
from accounts.permissions import IsStaffOrReadOnly


class HazardTypeViewSet(viewsets.ModelViewSet):
    """
    API endpoint for hazard types.
    GET: List all hazard types
    POST: Create new hazard type (authenticated users)
    """
    queryset = HazardType.objects.all()
    serializer_class = HazardTypeSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    search_fields = ['name', 'description']
    ordering_fields = ['name']


class IncidentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for incidents.
    Supports filtering by status, severity, hazard_type, barangay
    """
    queryset = Incident.objects.select_related(
        'hazard_type', 'barangay', 'reported_by'
    ).all()
    serializer_class = IncidentSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['description', 'address', 'hazard_type__name']
    ordering_fields = ['incident_datetime', 'severity_level', 'status']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by status
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        
        # Filter by severity
        severity = self.request.query_params.get('severity')
        if severity:
            queryset = queryset.filter(severity_level=severity)
        
        # Filter by hazard type
        hazard_type = self.request.query_params.get('hazard_type')
        if hazard_type:
            queryset = queryset.filter(hazard_type_id=hazard_type)
        
        # Filter by barangay
        barangay = self.request.query_params.get('barangay')
        if barangay:
            queryset = queryset.filter(barangay_id=barangay)
        
        return queryset.order_by('-incident_datetime')
    
    @action(detail=False, methods=['get'])
    def by_status(self, request):
        """Get incident count by status"""
        stats = Incident.objects.values('status').annotate(count=Count('id'))
        return Response({
            item['status']: item['count'] for item in stats
        })
    
    @action(detail=False, methods=['get'])
    def by_hazard_type(self, request):
        """Get incident count by hazard type"""
        stats = Incident.objects.values(
            'hazard_type__id', 'hazard_type__name'
        ).annotate(count=Count('id')).order_by('-count')
        
        return Response([{
            "hazard_type_id": str(item['hazard_type__id']),
            "hazard_type_name": item['hazard_type__name'],
            "count": item['count'],
        } for item in stats])


class AlertViewSet(viewsets.ModelViewSet):
    """API endpoint for alerts"""
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
    """API endpoint for responder reports"""
    queryset = ResponderReport.objects.select_related(
        'incident', 'responder'
    ).all().order_by('-report_time')
    serializer_class = ResponderReportSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]