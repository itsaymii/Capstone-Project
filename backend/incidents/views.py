from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.permissions import AllowAny
from django.db.models import Count, Q
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import (
    HazardType,
    Incident,
    Alert,
    ResponderReport,
    IncidentReport,
    AccomplishmentReport,
)

from .serializers import (
    HazardTypeSerializer,
    IncidentSerializer,
    AlertSerializer,
    ResponderReportSerializer,
    IncidentReportSerializer,
    AccomplishmentReportSerializer,
)

from accounts.permissions import IsStaffOrReadOnly


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
            'fire_details',
            'earthquake_details',
            'vehicular_accident_details',
            'crime_details',
            'medical_details',
            'drowning_details',
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

        reference_code = self.request.query_params.get('reference_code')
        if reference_code:
            queryset = queryset.filter(reference_code=reference_code.upper().strip())

        return queryset.order_by('-incident_datetime')

    @action(detail=False, methods=['get'])
    def by_status(self, request):
        stats = Incident.objects.values('status').annotate(count=Count('id'))
        return Response({item['status']: item['count'] for item in stats})

    @action(detail=False, methods=['get'])
    def by_hazard_type(self, request):
        stats = Incident.objects.values(
            'hazard_type__id',
            'hazard_type__name',
        ).annotate(count=Count('id')).order_by('-count')

        return Response([
            {
                'hazard_type_id': str(item['hazard_type__id']),
                'hazard_type_name': item['hazard_type__name'],
                'count': item['count'],
            }
            for item in stats
        ])

    @action(detail=False, methods=['get'], url_path='lookup/(?P<reference_code>[^/.]+)')
    def lookup_by_reference(self, request, reference_code=None):
        try:
            incident = Incident.objects.get_by_reference(reference_code)
            serializer = self.get_serializer(incident)
            return Response(serializer.data)
        except (Incident.DoesNotExist, DjangoValidationError, ValueError):
            return Response(
                {'error': f"Incident '{reference_code}' not found"},
                status=status.HTTP_404_NOT_FOUND,
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
    queryset = ResponderReport.objects.select_related(
        'incident',
        'responder',
    ).all().order_by('-report_time')
    serializer_class = ResponderReportSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(responder=self.request.user)


class IncidentReportViewSet(viewsets.ModelViewSet):
    queryset = IncidentReport.objects.prefetch_related('victims').select_related(
        'created_by'
    ).all()
    serializer_class = IncidentReportSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]

    # Temporary for frontend testing.
    # Later, change this back to [IsStaffOrReadOnly] once token auth is connected.
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(report_code__icontains=search) |
                Q(incident_code__icontains=search) |
                Q(incident_type__icontains=search) |
                Q(responder_team__icontains=search) |
                Q(location__icontains=search)
            )

        hazard_type = self.request.query_params.get('hazard_type')
        if hazard_type:
            queryset = queryset.filter(incident_type__iexact=hazard_type)

        from_date = self.request.query_params.get('from_date')
        if from_date:
            queryset = queryset.filter(created_at__date__gte=from_date)

        to_date = self.request.query_params.get('to_date')
        if to_date:
            queryset = queryset.filter(created_at__date__lte=to_date)

        ordering = self.request.query_params.get('ordering', '-created_at')
        return queryset.order_by(ordering)


class AccomplishmentReportViewSet(viewsets.ModelViewSet):
    queryset = AccomplishmentReport.objects.prefetch_related(
        'incident_reports',
        'incident_reports__victims',
    ).select_related('compiled_by').all()
    serializer_class = AccomplishmentReportSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]

    # Temporary for frontend testing.
    # Later, change this back to [IsStaffOrReadOnly] once token auth is connected.
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(compiled_code__icontains=search) |
                Q(title__icontains=search)
            )

        ordering = self.request.query_params.get('ordering', '-created_at')
        return queryset.order_by(ordering)