from datetime import datetime
from decimal import Decimal
from .utils import get_nearest_barangay

from django.utils import timezone
from rest_framework import serializers

from .models import (
    HazardType,
    Incident,
    Alert,
    ResponderReport,
    IncidentReport,
    AccomplishmentReport,
    VictimDetail,
    FireDetails,
    EarthquakeDetails,
    VehicularAccident,
    CrimeReport,
    MedicalEmergency,
    DrowningIncident,
)

from locations.serializers import BarangaySerializer
from .incident_types import validate_report_details
import re


LUCENA_COORDINATES = {
    'barangay 1': (13.9346, 121.6122),
    'barangay 2': (13.9361, 121.6135),
    'barangay 3': (13.9375, 121.6148),
    'barangay 4': (13.9389, 121.6162),
    'barangay 5': (13.9403, 121.6176),
    'barangay 6': (13.9417, 121.6190),
    'barangay 7': (13.9431, 121.6204),
    'barangay 8': (13.9445, 121.6218),
    'barangay 9': (13.9459, 121.6232),
    'barangay 10': (13.9473, 121.6246),
    'dalahican': (13.9147, 121.6502),
    'diversion': (13.9180, 121.6260),
    'quezon avenue': (13.9390, 121.6170),
    'gulang-gulang': (13.9494, 121.5986),
    'ibabang dupay': (13.9206, 121.6066),
    'ilayang iyam': (13.9530, 121.6159),
    'ibabang iyam': (13.9362, 121.6082),
    'mayao crossing': (13.9089, 121.5857),
    'mayao kanluran': (13.9001, 121.5741),
    'mayao silangan': (13.9029, 121.5994),
    'cotta': (13.9330, 121.6279),
    'bocohan': (13.9482, 121.6094),
    'isabang': (13.9718, 121.5821),
    'market view': (13.9338, 121.6161),
    'domoit': (13.9742, 121.6018),
}


def get_lucena_coordinates(location):
    value = (location or '').lower()

    for key, coords in LUCENA_COORDINATES.items():
        if key in value:
            return coords

    return 13.9414, 121.6236


def map_incident_type_to_hazard_name(incident_type):
    lower = (incident_type or '').lower()

    if 'fire' in lower:
        return 'Fire'
    if 'medical' in lower or 'ambulance' in lower or 'stand-by' in lower:
        return 'Medical Emergency'
    if 'rca' in lower or 'vehicular' in lower or 'accident' in lower:
        return 'Vehicular Accident'
    if 'crime' in lower:
        return 'Crime'
    if 'drowning' in lower:
        return 'Drowning'

    return 'Medical Emergency'


def map_incident_type_to_severity(incident_type, victim_count):
    lower = (incident_type or '').lower()

    if victim_count >= 5:
        return 'critical'
    if victim_count >= 3:
        return 'high'
    if 'fire' in lower or 'drowning' in lower or 'crime' in lower:
        return 'moderate'
    if victim_count > 0:
        return 'moderate'

    return 'low'


def _barangay_key(name):
    """'Barangay 10 (Pob.)' and 'Barangay 10' -> 'barangay10'; 'Gulang-Gulang' -> 'gulanggulang'."""
    return re.sub(r'[^a-z0-9]', '', re.sub(r'\(pob\.?\)', '', (name or '').lower()))


def match_report_barangay(location, latitude=None, longitude=None):
    """The Barangay a report is in: by the name the responder picked, else the nearest one."""
    from locations.models import Barangay

    picked = _barangay_key((location or '').split(',')[0])
    if picked:
        for barangay in Barangay.objects.only('id', 'name'):
            if _barangay_key(barangay.name) == picked:
                return barangay
    if latitude is not None and longitude is not None:
        try:
            return get_nearest_barangay(float(latitude), float(longitude))
        except Exception:
            return None
    return None


def validate_lucena_coordinates(latitude, longitude):
    if latitude is None or longitude is None:
        raise serializers.ValidationError({
            'latitude': 'Latitude is required.',
            'longitude': 'Longitude is required.',
        })

    lat = float(latitude)
    lng = float(longitude)

    if not (13.89 <= lat <= 13.98 and 121.57 <= lng <= 121.69):
        raise serializers.ValidationError({
            'coordinates': 'Coordinates must be within Lucena City area.',
        })

    return lat, lng


class HazardTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = HazardType
        fields = ['id', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class FireDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FireDetails
        fields = [
            'id',
            'cause',
            'damage_estimate',
            'casualties',
            'injuries',
            'structures_affected',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EarthquakeDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = EarthquakeDetails
        fields = ['id', 'magnitude', 'depth', 'intensity', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class VehicularAccidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicularAccident
        fields = [
            'id',
            'vehicles_involved',
            'casualties',
            'injuries',
            'cause',
            'vehicle_types',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CrimeReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrimeReport
        fields = [
            'id',
            'crime_type',
            'suspects',
            'victims',
            'arrested',
            'case_status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class MedicalEmergencySerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalEmergency
        fields = [
            'id',
            'patient_count',
            'emergency_type',
            'transported',
            'hospital',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DrowningIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DrowningIncident
        fields = [
            'id',
            'victims',
            'rescued',
            'fatalities',
            'water_body',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AlertSerializer(serializers.ModelSerializer):
    incident_id = serializers.UUIDField(source='incident.id', read_only=True)
    incident_reference_code = serializers.CharField(
        source='incident.reference_code',
        read_only=True,
    )

    class Meta:
        model = Alert
        fields = [
            'id',
            'incident_id',
            'incident_reference_code',
            'alert_type',
            'message',
            'severity',
            'is_active',
            'sent_at',
            'expires_at',
        ]
        read_only_fields = ['id', 'sent_at', 'incident_reference_code']


class ResponderReportSerializer(serializers.ModelSerializer):
    incident_reference_code = serializers.CharField(write_only=True, required=False)
    incident = serializers.UUIDField(write_only=True, required=False)

    incident_id = serializers.UUIDField(source='incident.id', read_only=True)
    incident_reference_code_readonly = serializers.CharField(
        source='incident.reference_code',
        read_only=True,
    )
    responder_username = serializers.CharField(source='responder.username', read_only=True)

    class Meta:
        model = ResponderReport
        fields = [
            'id',
            'incident_reference_code',
            'incident',
            'incident_id',
            'incident_reference_code_readonly',
            'responder',
            'responder_username',
            'report_time',
            'report_text',
            'action_taken',
            'media_url',
            'status_update',
        ]
        read_only_fields = [
            'id',
            'report_time',
            'responder',
            'incident_id',
            'incident_reference_code_readonly',
        ]

    def validate(self, data):
        ref_code = data.get('incident_reference_code')
        uuid_val = data.get('incident')

        if not ref_code and not uuid_val:
            raise serializers.ValidationError(
                "Either 'incident_reference_code' or 'incident' is required."
            )

        if ref_code and uuid_val:
            raise serializers.ValidationError(
                "Provide only one of 'incident_reference_code' or 'incident'."
            )

        return data

    def validate_incident_reference_code(self, value):
        val = value.strip().upper()

        if not re.match(r'^INC-\d{4}-\d{3,}$', val):
            raise serializers.ValidationError(
                'Invalid format. Use INC-YYYY-NNN, e.g. INC-2025-001.'
            )

        try:
            return Incident.objects.get_by_reference(val)
        except Incident.DoesNotExist:
            raise serializers.ValidationError(
                f"Incident '{val}' not found. Please select from Dispatch Ledger."
            )

    def validate_incident(self, value):
        try:
            return Incident.objects.get(id=value)
        except (Incident.DoesNotExist, ValueError):
            raise serializers.ValidationError(
                f"Incident with UUID '{value}' not found."
            )

    def create(self, validated_data):
        incident = validated_data.pop('incident_reference_code', None) or validated_data.pop('incident', None)

        if incident:
            validated_data['incident'] = incident

        return super().create(validated_data)


class IncidentSerializer(serializers.ModelSerializer):
    hazard_type = HazardTypeSerializer(read_only=True)
    hazard_type_id = serializers.UUIDField(write_only=True)

    barangay = BarangaySerializer(read_only=True)
    barangay_id = serializers.UUIDField(write_only=True, required=False)

    reported_by_username = serializers.CharField(
        source='reported_by.username',
        read_only=True,
    )
    coordinates = serializers.SerializerMethodField()

    reference_code = serializers.CharField(required=False)

    fire_details = FireDetailsSerializer(read_only=True)
    earthquake_details = EarthquakeDetailsSerializer(read_only=True)
    vehicular_accident_details = VehicularAccidentSerializer(read_only=True)
    crime_details = CrimeReportSerializer(read_only=True)
    medical_details = MedicalEmergencySerializer(read_only=True)
    drowning_details = DrowningIncidentSerializer(read_only=True)

    class Meta:
        model = Incident
        fields = [
            'id',
            'reference_code',
            'hazard_type',
            'hazard_type_id',
            'latitude',
            'longitude',
            'coordinates',
            'address',
            'barangay',
            'barangay_id',
            'reported_by_username',
            'date_reported',
            'incident_datetime',
            'severity_level',
            'status',
            'impact_level',
            'description',
            'fire_details',
            'earthquake_details',
            'vehicular_accident_details',
            'crime_details',
            'medical_details',
            'drowning_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'date_reported', 'created_at', 'updated_at']

    def get_coordinates(self, obj):
        return {
            'lat': float(obj.latitude),
            'lng': float(obj.longitude),
        }

    def create(self, validated_data):
        hazard_type_id = validated_data.pop('hazard_type_id')
        barangay_id = validated_data.pop('barangay_id', None)

        validated_data['hazard_type_id'] = hazard_type_id

        # ✅ AUTO-LINK: If no barangay provided, find nearest by coordinates
        if not barangay_id:
            lat = validated_data.get('latitude')
            lng = validated_data.get('longitude')
            nearest = get_nearest_barangay(lat, lng)
            if nearest:
                validated_data['barangay_id'] = nearest.id

        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            validated_data['reported_by'] = request.user

        return super().create(validated_data)


class VictimDetailSerializer(serializers.ModelSerializer):
    # Per-victim fields for the report's incident type (checked in IncidentReportSerializer.validate).
    details = serializers.JSONField(required=False)

    class Meta:
        model = VictimDetail
        fields = ['id', 'name', 'age', 'gender', 'address', 'condition', 'details']
        read_only_fields = ['id']


class IncidentReportSerializer(serializers.ModelSerializer):
    victims = VictimDetailSerializer(many=True, required=False)

    reportCode = serializers.CharField(source='report_code', read_only=True)
    incidentCode = serializers.CharField(source='incident_code', read_only=True)
    timeOccurred = serializers.TimeField(source='time_occurred')
    incidentType = serializers.CharField(source='incident_type')
    responderTeam = serializers.CharField(source='responder_team', required=False, allow_blank=True)
    victimCount = serializers.IntegerField(source='victim_count', required=False)
    actionTaken = serializers.CharField(source='action_taken')
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=True)
    coordinates = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    # Fields that only this incident type has (see incidents/incident_types.py).
    details = serializers.JSONField(required=False)

    # Include creator info to help the frontend decide selection eligibility
    createdBy = serializers.CharField(source='created_by.username', read_only=True)
    createdByRole = serializers.SerializerMethodField()
    # Barangay name for filters on the admin map (None when the report has no barangay).
    barangayName = serializers.CharField(source='barangay.name', read_only=True, default=None)
    # Code of the accomplishment report this report was compiled into, or None.
    compiledIn = serializers.SerializerMethodField()

    class Meta:
        model = IncidentReport
        fields = [
            'id',
            'reportCode',
            'incidentCode',
            'timeOccurred',
            'incidentType',
            'responderTeam',
            'location',
            'barangayName',
            'compiledIn',
            'latitude',
            'longitude',
            'coordinates',
            'description',
            'victimCount',
            'victims',
            'actionTaken',
            'status',
            'details',
            'createdAt',
            'createdBy',
            'createdByRole',
        ]
        read_only_fields = ['id', 'reportCode', 'createdAt']

    def get_compiledIn(self, obj):
        compiled = obj.accomplishment_reports.all()
        return compiled[0].compiled_code if compiled else None

    def get_coordinates(self, obj):
        return {
            'lat': float(obj.latitude) if obj.latitude is not None else None,
            'lng': float(obj.longitude) if obj.longitude is not None else None,
        }

    def validate(self, attrs):
        latitude = attrs.get('latitude')
        longitude = attrs.get('longitude')
        validate_lucena_coordinates(latitude, longitude)

        # Type-specific fields are always checked on new reports. On updates they are only checked
        # when the details, incident type, or victims change, so approving an older report (which
        # only sends the status) keeps working.
        is_new = self.instance is None
        if is_new or any(key in attrs for key in ('details', 'incident_type', 'victims')):
            incident_type = attrs.get('incident_type', getattr(self.instance, 'incident_type', ''))
            details = attrs.get('details', {} if is_new else self.instance.details)

            victims = attrs.get('victims')
            if victims is None and not is_new:
                victims_to_check = [{'details': victim.details} for victim in self.instance.victims.all()]
            else:
                victims_to_check = victims or []

            cleaned, victim_details, errors = validate_report_details(incident_type, details, victims_to_check)
            if errors:
                raise serializers.ValidationError(errors)

            attrs['details'] = cleaned
            if victims is not None:
                for victim, victim_extra in zip(victims, victim_details):
                    victim['details'] = victim_extra

        return attrs

    def create(self, validated_data):
        victims_data = validated_data.pop('victims', [])
        request = self.context.get('request')

        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
            # The responding team is the logged-in account, whatever the form sent.
            full_name = f"{request.user.first_name} {request.user.last_name}".strip()
            validated_data['responder_team'] = (full_name or request.user.username)[:100]
        elif not (validated_data.get('responder_team') or '').strip():
            raise serializers.ValidationError({'responderTeam': 'Responding team is required.'})

        incoming_victim_count = validated_data.pop('victim_count', None)
        if incoming_victim_count is None:
            validated_data['victim_count'] = len(victims_data)
        else:
            validated_data['victim_count'] = max(int(incoming_victim_count), len(victims_data))

        if not validated_data.get('barangay'):
            validated_data['barangay'] = match_report_barangay(
                validated_data.get('location', ''),
                validated_data.get('latitude'),
                validated_data.get('longitude'),
            )

        incident_report = IncidentReport.objects.create(**validated_data)

        for victim in victims_data:
            VictimDetail.objects.create(
                incident_report=incident_report,
                **victim,
            )

        # NOTE: Incident creation is deferred to post_save signal.
        # Incidents are created only when status transitions to 'Approved'.

        return incident_report

    def get_createdByRole(self, obj):
        # Return a simple role for frontend consumption: 'anonymous', 'admin', 'staff', or 'responder'
        if not obj.created_by:
            return 'anonymous'

        try:
            role = obj.created_by.account_profile.role
        except Exception:
            role = None

        if role == 'admin':
            return 'admin'
        if role == 'staff':
            return 'staff'

        # Default to 'responder' for other roles
        return 'responder'

    def create_admin_incident(self, incident_report, request):
        hazard_name = map_incident_type_to_hazard_name(incident_report.incident_type)
        hazard_type, _ = HazardType.objects.get_or_create(
            name=hazard_name,
            defaults={'description': f'{hazard_name} generated from responder report'}
        )

        if incident_report.latitude is not None and incident_report.longitude is not None:
            lat = incident_report.latitude
            lng = incident_report.longitude
        else:
            lat, lng = get_lucena_coordinates(incident_report.location)

        now = timezone.localtime()
        occurred_time = incident_report.time_occurred

        incident_datetime = timezone.make_aware(
            datetime.combine(now.date(), occurred_time)
        )

        existing_incident = Incident.objects.filter(
            reference_code__iexact=incident_report.incident_code
        ).first()

        if existing_incident:
            return existing_incident

        severity = map_incident_type_to_severity(
            incident_report.incident_type,
            incident_report.victim_count,
        )

        incident = Incident.objects.create(
            reference_code=incident_report.incident_code,
            hazard_type=hazard_type,
            latitude=Decimal(str(lat)),
            longitude=Decimal(str(lng)),
            address=incident_report.location,
            reported_by=request.user if request and request.user.is_authenticated else None,
            incident_datetime=incident_datetime,
            severity_level=severity,
            status='reported',
            impact_level='minor' if incident_report.victim_count > 0 else 'minimal',
            description=incident_report.description,
        )

        lower = incident_report.incident_type.lower()

        if 'fire' in lower:
            FireDetails.objects.create(
                incident=incident,
                cause='Reported by responder',
                damage_estimate=None,
                casualties=0,
                injuries=incident_report.victim_count,
                structures_affected=1,
            )

        elif 'rca' in lower or 'vehicular' in lower or 'accident' in lower:
            VehicularAccident.objects.create(
                incident=incident,
                vehicles_involved=1,
                casualties=0,
                injuries=incident_report.victim_count,
                cause='Reported by responder',
                vehicle_types='Not specified',
            )

        elif 'crime' in lower:
            CrimeReport.objects.create(
                incident=incident,
                crime_type=incident_report.incident_type,
                suspects=0,
                victims=incident_report.victim_count,
                arrested=False,
                case_status='under_investigation',
            )

        elif 'medical' in lower or 'ambulance' in lower or 'stand-by' in lower:
            MedicalEmergency.objects.create(
                incident=incident,
                patient_count=max(incident_report.victim_count, 1),
                emergency_type=incident_report.incident_type,
                transported=0,
                hospital='',
            )

        elif 'drowning' in lower:
            DrowningIncident.objects.create(
                incident=incident,
                victims=max(incident_report.victim_count, 1),
                rescued=0,
                fatalities=0,
                water_body='Not specified',
            )

        return incident


class AccomplishmentReportSerializer(serializers.ModelSerializer):
    reports = IncidentReportSerializer(source='incident_reports', many=True, read_only=True)
    reportIds = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=True
    )

    compiledCode = serializers.CharField(source='compiled_code', read_only=True)
    totalReports = serializers.IntegerField(source='total_reports', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    compiledBy = serializers.CharField(source='compiled_by.username', read_only=True, default=None)

    class Meta:
        model = AccomplishmentReport
        fields = [
            'id',
            'compiledCode',
            'title',
            'reports',
            'reportIds',
            'totalReports',
            'status',
            'createdAt',
            'compiledBy',
        ]
        read_only_fields = ['id', 'compiledCode', 'reports', 'totalReports', 'createdAt', 'compiledBy']

    def create(self, validated_data):
        report_ids = validated_data.pop('reportIds', [])
        request = self.context.get('request')

        # Accept either UUID primary keys or human-readable codes (report_code / incident_code)
        # Build lists for matching
        uuid_like = []
        code_like = []
        for rid in report_ids:
            try:
                # try treating as UUID by importing uuid
                import uuid as _uuid

                _uuid.UUID(str(rid))
                uuid_like.append(rid)
            except Exception:
                # treat as code (IR-..., INC-...)
                code_like.append(str(rid).strip())

        from django.db.models import Q
        from accounts.models import AccountProfile

        query = Q()
        if uuid_like:
            query |= Q(id__in=uuid_like)
        if code_like:
            query |= Q(report_code__in=code_like) | Q(incident_code__in=code_like)

        requested_reports = IncidentReport.objects.filter(query).select_related('created_by')
        already_compiled_reports = requested_reports.filter(accomplishment_reports__isnull=False).distinct()

        if already_compiled_reports.exists():
            duplicate_codes = [r.report_code or str(r.id) for r in already_compiled_reports]
            raise serializers.ValidationError({
                'reportIds': [
                    'The following report(s) have already been compiled and cannot be recompiled: ' + ', '.join(duplicate_codes)
                ]
            })

        eligible_reports = requested_reports.exclude(
            created_by__account_profile__role__in=[AccountProfile.ROLE_ADMIN, AccountProfile.ROLE_STAFF]
        )

        # Build sets of found identifiers for clearer diagnostics
        found_uuid_set = set(str(r.id) for r in eligible_reports)
        found_code_set = set()
        for r in eligible_reports:
            if r.report_code:
                found_code_set.add(r.report_code)
            if r.incident_code:
                found_code_set.add(r.incident_code)

        # Determine which requested ids did not match any eligible report
        missing = []
        for rid in report_ids:
            if rid in found_uuid_set or str(rid).strip() in found_code_set:
                continue
            missing.append(rid)

        if missing:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning('Accomplishment compile: missing requested reports: %s', missing)
            # Do not fail the request; proceed with the reports that were found.
            # The frontend will receive a successful response and can be notified
            # that some requested items were not included.

        accomplishment = AccomplishmentReport.objects.create(
            title=validated_data.get('title', 'Accomplishment Report'),
            total_reports=eligible_reports.count(),
            status=validated_data.get('status', 'Compiled'),
            compiled_by=request.user if request and request.user.is_authenticated else None,
        )

        accomplishment.incident_reports.set(eligible_reports)

        return accomplishment