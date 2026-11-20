from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from django.db.models import Count, Prefetch, Q
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import (
    HazardType,
    Incident,
    Alert,
    ResponderReport,
    IncidentReport,
    AccomplishmentReport,
    VehicularAccidentVehicleType,
)

from .serializers import (
    HazardTypeSerializer,
    IncidentSerializer,
    AlertSerializer,
    ResponderReportSerializer,
    IncidentReportSerializer,
    AccomplishmentReportSerializer,
    PublicIncidentReportSerializer,
)

from accounts.models import AccountProfile, get_user_role
from accounts.permissions import IsDashboardAdmin, IsDashboardAdminOrReadOnly, IsDashboardUser, IsResponderCreateAdminChange


class HazardTypeViewSet(viewsets.ModelViewSet):
    queryset = HazardType.objects.all()
    serializer_class = HazardTypeSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsDashboardAdminOrReadOnly]
    search_fields = ['name', 'description']
    ordering_fields = ['name']


class IncidentViewSet(viewsets.ModelViewSet):
    serializer_class = IncidentSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    # Admins only, reads included: incidents carry the reporter's username and the report's free-text
    # description, which can name victims. Public pages use /incident-reports/public/ instead.
    permission_classes = [IsDashboardAdmin]
    search_fields = ['description', 'address', 'hazard_type__name', 'reference_code']
    ordering_fields = ['incident_datetime', 'severity_level', 'status']

    def get_queryset(self):
        queryset = Incident.objects.select_related(
            'hazard_type', 'barangay', 'reported_by'
        ).prefetch_related(
            'fire_details',
            'earthquake_details',
            'vehicular_accident_details',
            Prefetch(
                'vehicular_accident_details__vehicle_type_links',
                queryset=VehicularAccidentVehicleType.objects.select_related('vehicle_type').order_by('position', 'id'),
            ),
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
    permission_classes = [IsDashboardAdminOrReadOnly]

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
    permission_classes = [IsDashboardUser]

    def perform_create(self, serializer):
        serializer.save(responder=self.request.user)


class IncidentReportPagination(PageNumberPagination):
    """100 reports a page by default; `?page_size=` asks for fewer (the dashboard's latest few) or more (up to 500)."""

    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 500


class IncidentReportViewSet(viewsets.ModelViewSet):
    queryset = IncidentReport.objects.select_related(
        'created_by',
        # Read by createdByRole on every report; without it each report costs one more query.
        'created_by__account_profile',
        'barangay',
        'responder_team_record',
        'road_crash_details',
        'fire_report_details',
        'crime_report_details',
        'medical_report_details',
        'ambulance_report_details',
        'standby_medical_details',
        'drowning_report_details',
    ).prefetch_related(
        'victims',
        'victims__road_crash_details',
        'victims__fire_details',
        'victims__medical_details',
        'road_crash_details__vehicle_types',
        'standby_medical_details__cases_handled',
        'accomplishment_reports',
    ).all()
    serializer_class = IncidentReportSerializer
    pagination_class = IncidentReportPagination
    authentication_classes = [SessionAuthentication, TokenAuthentication]

    # Responders (staff) and admins read; only responders file; only admins edit, approve or delete.
    permission_classes = [IsResponderCreateAdminChange]

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

    def perform_create(self, serializer):
        # Only an admin can approve, so a responder cannot file a report as already approved.
        if get_user_role(self.request.user) != AccountProfile.ROLE_ADMIN:
            requested = str(serializer.validated_data.get('status') or '').lower()
            if requested == 'approved':
                serializer.save(status='Pending')
                return
        serializer.save()

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny], url_path='public')
    def public(self, request):
        """Approved reports for the public Landing page and Disaster Map, without personal data."""
        reports = (
            IncidentReport.objects.select_related('barangay', 'responder_team_record')
            .filter(status__iexact='approved')
            .order_by('-created_at')[:500]
        )
        return Response(PublicIncidentReportSerializer(reports, many=True).data)


class AccomplishmentReportViewSet(viewsets.ModelViewSet):
    queryset = AccomplishmentReport.objects.prefetch_related(
        'incident_reports',
        'incident_reports__responder_team_record',
        'incident_reports__victims',
        'incident_reports__victims__road_crash_details',
        'incident_reports__victims__fire_details',
        'incident_reports__victims__medical_details',
        'incident_reports__road_crash_details',
        'incident_reports__road_crash_details__vehicle_types',
        'incident_reports__fire_report_details',
        'incident_reports__crime_report_details',
        'incident_reports__medical_report_details',
        'incident_reports__ambulance_report_details',
        'incident_reports__standby_medical_details',
        'incident_reports__standby_medical_details__cases_handled',
        'incident_reports__drowning_report_details',
        'incident_reports__accomplishment_reports',
        'incident_reports__created_by__account_profile',
        'incident_reports__barangay',
    ).select_related('compiled_by').all()
    serializer_class = AccomplishmentReportSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]

    # Responders (staff) and admins read; only responders file; only admins edit, approve or delete.
    permission_classes = [IsResponderCreateAdminChange]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Only include accomplishment reports that originated from the responder side.
        # Responder accounts have the staff role, so only admin-compiled reports are left out.
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(compiled_code__icontains=search) |
                Q(title__icontains=search)
            )

        queryset = queryset.exclude(compiled_by__account_profile__role=AccountProfile.ROLE_ADMIN).exclude(
            compiled_by__is_superuser=True
        )

        ordering = self.request.query_params.get('ordering', '-created_at')
        return queryset.order_by(ordering)