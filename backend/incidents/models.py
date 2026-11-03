import uuid
from django.db import models, transaction
from django.conf import settings
from django.utils import timezone
from django.db.models.functions import Length



class HazardType(models.Model):
    """Master list of hazard categories"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hazard_types'
        ordering = ['name']
        verbose_name_plural = 'Hazard Types'

    def __str__(self):
        return self.name


class IncidentManager(models.Manager):
    """Custom manager for easy reference_code lookups"""
    def get_by_reference(self, value):
        """Lookup incident by reference_code OR UUID"""
        # Try finding by reference code first (case insensitive)
        incident = self.filter(reference_code__iexact=str(value).strip()).first()
        if incident:
            return incident
        # Otherwise treat as UUID/Internal ID
        return self.get(id=value)


class Incident(models.Model):
    """Core incident table - all disaster types link here"""

    SEVERITY_CHOICES = [
        ('low', 'Low'), ('moderate', 'Moderate'),
        ('high', 'High'), ('critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('reported', 'Reported'), ('verified', 'Verified'),
        ('ongoing', 'Ongoing'), ('contained', 'Contained'),
        ('resolved', 'Resolved'), ('false_alarm', 'False Alarm'),
    ]
    IMPACT_CHOICES = [
        ('minimal', 'Minimal'), ('minor', 'Minor'),
        ('major', 'Major'), ('severe', 'Severe'),
        ('catastrophic', 'Catastrophic'),
    ]

    # ✅ UUID remains as internal PK for FK relationships (best practice)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ✅ Human-readable reference code as PRIMARY external identifier
    reference_code = models.CharField(
        max_length=20, 
        unique=True, 
        blank=True,  # ✅ Allow empty input for auto-generation
        db_index=True,  # ✅ Fast lookups
        help_text="Incident reference code (e.g., INC-2025-001). Auto-generated if blank."
    )

    hazard_type = models.ForeignKey(
        HazardType, on_delete=models.PROTECT, related_name='incidents'
    )

    # Location
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    address = models.TextField(blank=True)
    barangay = models.ForeignKey(
        'locations.Barangay', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='incidents'
    )

    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='reported_incidents'
    )
    date_reported = models.DateTimeField(auto_now_add=True)
    incident_datetime = models.DateTimeField()
    severity_level = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='reported')
    impact_level = models.CharField(max_length=20, choices=IMPACT_CHOICES, default='minimal')
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = IncidentManager()  # ✅ Custom manager

    class Meta:
        db_table = 'incidents'
        ordering = ['-incident_datetime']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['severity_level']),
            models.Index(fields=['incident_datetime']),
            models.Index(fields=['reference_code']),  # ✅ Optimized lookup
        ]

    def __str__(self):
        return f"{self.reference_code} - {self.hazard_type.name}"

    def save(self, *args, **kwargs):
        # ✅ Auto-generate reference_code ONLY if it hasn't been set yet
        if not self.reference_code:
            with transaction.atomic():
                year = self.incident_datetime.year if self.incident_datetime else timezone.now().year
                # Lock table for safe sequence generation
                # Order by length then code to handle numbers >= 1000 correctly in lexicographical sort
                last = Incident.objects.select_for_update().filter(
                    reference_code__startswith=f'INC-{year}-'
                ).order_by(Length('reference_code'), 'reference_code').last()

                next_num = 1
                if last:
                    try:
                        last_num = int(last.reference_code.split('-')[-1])
                        next_num = last_num + 1
                    except (ValueError, IndexError):
                        next_num = 1

                self.reference_code = f'INC-{year}-{next_num:03d}'

        super().save(*args, **kwargs)

    def get_coordinates(self):
        return {'lat': float(self.latitude), 'lng': float(self.longitude)}


class VehicleType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# ✅ Related models remain unchanged (they reference Incident.id internally)
class FireDetails(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(Incident, on_delete=models.CASCADE, related_name='fire_details')
    cause = models.CharField(max_length=200, blank=True)
    damage_estimate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    casualties = models.IntegerField(default=0)
    injuries = models.IntegerField(default=0)
    structures_affected = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'fire_details'
    def __str__(self): return f"Fire: {self.incident.reference_code}"


class EarthquakeDetails(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(Incident, on_delete=models.CASCADE, related_name='earthquake_details')
    magnitude = models.DecimalField(max_digits=3, decimal_places=1)
    depth = models.DecimalField(max_digits=6, decimal_places=2, help_text="Depth in km")
    intensity = models.CharField(max_length=50, blank=True, help_text="PEIS intensity scale")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'earthquake_details'
    def __str__(self): return f"Earthquake: M{self.magnitude}"


class VehicularAccident(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(Incident, on_delete=models.CASCADE, related_name='vehicular_accident_details')
    vehicles_involved = models.IntegerField(default=1)
    casualties = models.IntegerField(default=0)
    injuries = models.IntegerField(default=0)
    cause = models.CharField(max_length=200, blank=True)
    vehicle_type_records = models.ManyToManyField(
        VehicleType,
        through='VehicularAccidentVehicleType',
        related_name='accidents',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'vehicular_accidents'

    @property
    def vehicle_types(self):
        if '_pending_vehicle_types' in self.__dict__:
            return ', '.join(self.__dict__['_pending_vehicle_types'])
        return ', '.join(
            link.vehicle_type.name
            for link in self.vehicle_type_links.select_related('vehicle_type')
            .order_by('position', 'id')
        )

    @vehicle_types.setter
    def vehicle_types(self, value):
        self.__dict__['_pending_vehicle_types'] = [
            item.strip() for item in (value or '').split(',') if item.strip()
        ]

    def save(self, *args, **kwargs):
        pending_types = self.__dict__.pop('_pending_vehicle_types', None)
        super().save(*args, **kwargs)
        if pending_types is not None:
            self.vehicle_type_links.all().delete()
            type_records = [
                VehicleType.objects.get_or_create(name=name)[0]
                for name in dict.fromkeys(pending_types)
            ]
            VehicularAccidentVehicleType.objects.bulk_create([
                VehicularAccidentVehicleType(
                    accident=self,
                    vehicle_type=vehicle_type,
                    position=position,
                )
                for position, vehicle_type in enumerate(type_records)
            ])

    def __str__(self): return f"Accident: {self.incident.reference_code}"


class VehicularAccidentVehicleType(models.Model):
    accident = models.ForeignKey(VehicularAccident, on_delete=models.CASCADE, related_name='vehicle_type_links')
    vehicle_type = models.ForeignKey(VehicleType, on_delete=models.PROTECT, related_name='accident_links')
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']
        constraints = [
            models.UniqueConstraint(fields=['accident', 'vehicle_type'], name='uniq_accident_vehicle_type'),
        ]


class CrimeReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(Incident, on_delete=models.CASCADE, related_name='crime_details')
    crime_type = models.CharField(max_length=100)
    suspects = models.IntegerField(default=0)
    victims = models.IntegerField(default=0)
    arrested = models.BooleanField(default=False)
    case_status = models.CharField(max_length=50, default='under_investigation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'crime_reports'
    def __str__(self): return f"Crime: {self.crime_type}"


class MedicalEmergency(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(Incident, on_delete=models.CASCADE, related_name='medical_details')
    patient_count = models.IntegerField(default=1)
    emergency_type = models.CharField(max_length=100)
    transported = models.IntegerField(default=0, help_text="Number transported to hospital")
    hospital = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'medical_emergencies'
    def __str__(self): return f"Medical: {self.emergency_type}"


class DrowningIncident(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(Incident, on_delete=models.CASCADE, related_name='drowning_details')
    victims = models.IntegerField(default=0)
    rescued = models.IntegerField(default=0)
    fatalities = models.IntegerField(default=0)
    water_body = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'drowning_incidents'
    def __str__(self): return f"Drowning: {self.incident.reference_code}"


class Alert(models.Model):
    ALERT_TYPE_CHOICES = [
        ('warning', 'Warning'), ('evacuation', 'Evacuation Order'),
        ('all_clear', 'All Clear'), ('advisory', 'Advisory'),
    ]
    SEVERITY_CHOICES = [('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('critical', 'Critical')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='alerts')
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPE_CHOICES)
    message = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    is_active = models.BooleanField(default=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'alerts'
        ordering = ['-sent_at']
        indexes = [models.Index(fields=['is_active']), models.Index(fields=['alert_type'])]

    def __str__(self): return f"{self.alert_type} - {self.incident.reference_code}"


class ResponderReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='responder_reports')
    responder = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='responder_reports')
    report_time = models.DateTimeField(auto_now_add=True)
    report_text = models.TextField()
    action_taken = models.TextField(blank=True)
    media_url = models.URLField(blank=True, help_text="Photo/video URL")
    status_update = models.CharField(max_length=50, default='ongoing')

    class Meta:
        db_table = 'responder_reports'
        ordering = ['-report_time']
        indexes = [models.Index(fields=['report_time'])]

    def __str__(self): 
        return f"Report for {self.incident.reference_code} by {self.responder}"

DEFAULT_RESPONDER_TEAMS = [
    ('alpha', 'Alpha'),
    ('bravo', 'Bravo'),
    ('charlie', 'Charlie'),
]

RESPONDER_TEAM_ALIASES = {
    'alpha': 'alpha',
    'team alpha': 'alpha',
    'bravo': 'bravo',
    'team bravo': 'bravo',
    'charlie': 'charlie',
    'team charlie': 'charlie',
}


class ResponderTeam(models.Model):
    code = models.SlugField(max_length=30, unique=True)
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = 'responder_teams'
        ordering = ['name']

    def __str__(self):
        return self.name


def responder_team_for_legacy_name(value):
    code = RESPONDER_TEAM_ALIASES.get((value or '').strip().casefold())
    return ResponderTeam.objects.filter(code=code).first() if code else None


class IncidentReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_code = models.CharField(max_length=30, unique=True, blank=True)
    incident_code = models.CharField(max_length=30, unique=True, blank=True, db_index=True)
    incident = models.OneToOneField(
        Incident,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_report',
    )
    time_occurred = models.TimeField()
    incident_type = models.CharField(max_length=100)
    responder_team = models.CharField(max_length=100)
    responder_team_record = models.ForeignKey(
        ResponderTeam,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incident_reports',
    )
    location = models.TextField(blank=True)
    barangay = models.ForeignKey(
        'locations.Barangay',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incident_reports'
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    description = models.TextField()
    victim_count = models.PositiveIntegerField(default=0)
    action_taken = models.TextField()
    status = models.CharField(max_length=30, default='Submitted')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'incident_reports'
        ordering = ['-created_at']

    @property
    def details(self):
        if '_pending_details' in self.__dict__:
            return self.__dict__['_pending_details']
        return get_report_detail_values(self)

    @details.setter
    def details(self, values):
        self.__dict__['_pending_details'] = values or {}

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        team_text_changed = update_fields is None or 'responder_team' in update_fields
        if team_text_changed and not self.responder_team_record_id:
            self.responder_team_record = responder_team_for_legacy_name(self.responder_team)
        if update_fields is not None and team_text_changed:
            kwargs['update_fields'] = set(update_fields) | {'responder_team_record'}

        is_adding = self._state.adding
        has_pending_details = '_pending_details' in self.__dict__
        pending_details = self.__dict__.pop('_pending_details', {})
        with transaction.atomic():
            if not self.incident_code:
                year = timezone.now().year
                last_incident_report = IncidentReport.objects.select_for_update().filter(
                    incident_code__startswith=f'INC-{year}-'
                ).order_by(Length('incident_code'), 'incident_code').last()

                next_incident_num = 1
                if last_incident_report:
                    try:
                        next_incident_num = int(last_incident_report.incident_code.split('-')[-1]) + 1
                    except (ValueError, IndexError):
                        next_incident_num = 1

                self.incident_code = f'INC-{year}-{next_incident_num:05d}'

            if not self.report_code:
                year = timezone.now().year
                last_report = IncidentReport.objects.select_for_update().filter(
                    report_code__startswith=f'IR-{year}-'
                ).order_by(Length('report_code'), 'report_code').last()

                next_report_num = 1
                if last_report:
                    try:
                        next_report_num = int(last_report.report_code.split('-')[-1]) + 1
                    except (ValueError, IndexError):
                        next_report_num = 1

                self.report_code = f'IR-{year}-{next_report_num:05d}'

            if has_pending_details and not is_adding:
                save_report_detail_values(self, pending_details)

            if has_pending_details and is_adding and str(self.status).lower() == 'approved':
                approved_status = self.status
                self.status = 'Pending'
                super().save(*args, **kwargs)
                save_report_detail_values(self, pending_details)
                self.status = approved_status
                super().save(update_fields=['status'])
            else:
                super().save(*args, **kwargs)
                if has_pending_details and is_adding:
                    save_report_detail_values(self, pending_details)


class VictimDetail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident_report = models.ForeignKey(IncidentReport, on_delete=models.CASCADE, related_name='victims')
    name = models.CharField(max_length=150)
    age = models.CharField(max_length=20)
    gender = models.CharField(max_length=10)
    address = models.TextField()
    condition = models.TextField()

    class Meta:
        db_table = 'victim_details'

    @property
    def details(self):
        if '_pending_details' in self.__dict__:
            return self.__dict__['_pending_details']
        return get_victim_detail_values(self)

    @details.setter
    def details(self, values):
        self.__dict__['_pending_details'] = values or {}

    def save(self, *args, **kwargs):
        has_pending_details = '_pending_details' in self.__dict__
        pending_details = self.__dict__.pop('_pending_details', {})
        super().save(*args, **kwargs)
        if has_pending_details:
            save_victim_detail_values(self, pending_details)

    def __str__(self):
        return f'{self.name} - {self.incident_report.report_code}'


class RoadCrashReportDetails(models.Model):
    incident_report = models.OneToOneField(IncidentReport, on_delete=models.CASCADE, related_name='road_crash_details')
    vehicles_involved = models.PositiveIntegerField(null=True, blank=True)
    collision_type = models.CharField(max_length=32, null=True, blank=True)
    suspected_cause = models.CharField(max_length=32, null=True, blank=True)
    road_condition = models.CharField(max_length=32, null=True, blank=True)
    fatalities = models.PositiveIntegerField(null=True, blank=True)
    traffic_blocked = models.BooleanField(null=True, blank=True)
    police_notified = models.BooleanField(null=True, blank=True)
    police_blotter_no = models.CharField(max_length=200, null=True, blank=True)


class RoadCrashVehicleType(models.Model):
    details = models.ForeignKey(RoadCrashReportDetails, on_delete=models.CASCADE, related_name='vehicle_types')
    value = models.CharField(max_length=32)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']
        constraints = [
            models.UniqueConstraint(fields=['details', 'value'], name='uniq_road_crash_vehicle_type'),
        ]


class FireReportDetails(models.Model):
    incident_report = models.OneToOneField(IncidentReport, on_delete=models.CASCADE, related_name='fire_report_details')
    structure_type = models.CharField(max_length=32, null=True, blank=True)
    alarm_level = models.CharField(max_length=32, null=True, blank=True)
    suspected_cause = models.CharField(max_length=32, null=True, blank=True)
    structures_affected = models.PositiveIntegerField(null=True, blank=True)
    families_affected = models.PositiveIntegerField(null=True, blank=True)
    estimated_damage = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    fatalities = models.PositiveIntegerField(null=True, blank=True)
    bfp_present = models.BooleanField(null=True, blank=True)
    fire_out_time = models.TimeField(null=True, blank=True)


class CrimeIncidentDetails(models.Model):
    incident_report = models.OneToOneField(IncidentReport, on_delete=models.CASCADE, related_name='crime_report_details')
    crime_type = models.CharField(max_length=32, null=True, blank=True)
    weapon = models.CharField(max_length=32, null=True, blank=True)
    suspects = models.PositiveIntegerField(null=True, blank=True)
    suspect_status = models.CharField(max_length=32, null=True, blank=True)
    pnp_coordinated = models.BooleanField(null=True, blank=True)
    police_blotter_no = models.CharField(max_length=200, null=True, blank=True)


class MedicalIncidentDetails(models.Model):
    incident_report = models.OneToOneField(IncidentReport, on_delete=models.CASCADE, related_name='medical_report_details')
    chief_complaint = models.CharField(max_length=32, null=True, blank=True)
    consciousness = models.CharField(max_length=32, null=True, blank=True)
    transported = models.BooleanField(null=True, blank=True)
    hospital = models.CharField(max_length=200, null=True, blank=True)


class AmbulanceIncidentDetails(models.Model):
    incident_report = models.OneToOneField(IncidentReport, on_delete=models.CASCADE, related_name='ambulance_report_details')
    pickup_location = models.CharField(max_length=200, null=True, blank=True)
    destination_hospital = models.CharField(max_length=200, null=True, blank=True)
    transport_reason = models.CharField(max_length=32, null=True, blank=True)
    ambulance_unit = models.CharField(max_length=200, null=True, blank=True)
    departure_time = models.TimeField(null=True, blank=True)
    arrival_time = models.TimeField(null=True, blank=True)
    condition_on_arrival = models.CharField(max_length=32, null=True, blank=True)


class StandbyMedicalDetails(models.Model):
    incident_report = models.OneToOneField(IncidentReport, on_delete=models.CASCADE, related_name='standby_medical_details')
    event_name = models.CharField(max_length=200, null=True, blank=True)
    venue = models.CharField(max_length=200, null=True, blank=True)
    organizer = models.CharField(max_length=200, null=True, blank=True)
    duty_start = models.TimeField(null=True, blank=True)
    duty_end = models.TimeField(null=True, blank=True)
    crowd_estimate = models.PositiveIntegerField(null=True, blank=True)
    team_members = models.PositiveIntegerField(null=True, blank=True)
    persons_assisted = models.PositiveIntegerField(null=True, blank=True)


class StandbyMedicalCase(models.Model):
    details = models.ForeignKey(StandbyMedicalDetails, on_delete=models.CASCADE, related_name='cases_handled')
    value = models.CharField(max_length=32)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']
        constraints = [
            models.UniqueConstraint(fields=['details', 'value'], name='uniq_standby_medical_case'),
        ]


class DrowningReportDetails(models.Model):
    incident_report = models.OneToOneField(IncidentReport, on_delete=models.CASCADE, related_name='drowning_report_details')
    water_body = models.CharField(max_length=32, null=True, blank=True)
    activity = models.CharField(max_length=32, null=True, blank=True)
    rescued_alive = models.PositiveIntegerField(null=True, blank=True)
    revived_cpr = models.PositiveIntegerField(null=True, blank=True)
    fatalities = models.PositiveIntegerField(null=True, blank=True)
    missing = models.PositiveIntegerField(null=True, blank=True)
    search_ongoing = models.BooleanField(null=True, blank=True)
    coast_guard_involved = models.BooleanField(null=True, blank=True)


class RoadCrashVictimDetails(models.Model):
    victim = models.OneToOneField(VictimDetail, on_delete=models.CASCADE, related_name='road_crash_details')
    person_role = models.CharField(max_length=32, null=True, blank=True)
    protective_gear = models.CharField(max_length=32, null=True, blank=True)


class FireVictimDetails(models.Model):
    victim = models.OneToOneField(VictimDetail, on_delete=models.CASCADE, related_name='fire_details')
    injury_type = models.CharField(max_length=32, null=True, blank=True)


class MedicalVictimDetails(models.Model):
    victim = models.OneToOneField(VictimDetail, on_delete=models.CASCADE, related_name='medical_details')
    blood_pressure = models.CharField(max_length=200, null=True, blank=True)
    pulse_rate = models.PositiveSmallIntegerField(null=True, blank=True)
    respiratory_rate = models.PositiveSmallIntegerField(null=True, blank=True)
    oxygen_saturation = models.PositiveSmallIntegerField(null=True, blank=True)
    temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)


def _report_detail_config(report):
    from .incident_types import get_incident_type

    config = get_incident_type(report.incident_type)
    return config


def get_report_detail_values(report):
    config = _report_detail_config(report)
    if not config:
        return {}

    model_by_key = {
        'rca': ('road_crash_details', RoadCrashReportDetails),
        'fire': ('fire_report_details', FireReportDetails),
        'crime': ('crime_report_details', CrimeIncidentDetails),
        'medical': ('medical_report_details', MedicalIncidentDetails),
        'ambulance': ('ambulance_report_details', AmbulanceIncidentDetails),
        'standby': ('standby_medical_details', StandbyMedicalDetails),
        'drowning': ('drowning_report_details', DrowningReportDetails),
    }
    relation_name, model = model_by_key[config['key']]
    try:
        record = getattr(report, relation_name)
    except model.DoesNotExist:
        return {}

    values = {}
    for spec in config['fields']:
        if spec['kind'] == 'multi_choice':
            related_name = 'vehicle_types' if config['key'] == 'rca' else 'cases_handled'
            values_for_field = [
                choice.value for choice in getattr(record, related_name).all()
            ]
            if values_for_field:
                values[spec['name']] = values_for_field
            continue

        value = getattr(record, spec['name'])
        if value is None or value == '':
            continue
        if spec['kind'] == 'time':
            values[spec['name']] = value.strftime('%H:%M')
        elif spec['kind'] == 'decimal':
            values[spec['name']] = float(value)
        else:
            values[spec['name']] = value
    return values


def save_report_detail_values(report, values):
    config = _report_detail_config(report)
    model_by_key = {
        'rca': RoadCrashReportDetails,
        'fire': FireReportDetails,
        'crime': CrimeIncidentDetails,
        'medical': MedicalIncidentDetails,
        'ambulance': AmbulanceIncidentDetails,
        'standby': StandbyMedicalDetails,
        'drowning': DrowningReportDetails,
    }
    for model in model_by_key.values():
        if not config or model is not model_by_key[config['key']]:
            model.objects.filter(incident_report=report).delete()
    if not config:
        if values:
            raise ValueError(f'No relational detail model for incident type {report.incident_type!r}.')
        return

    model = model_by_key[config['key']]
    record, _ = model.objects.get_or_create(incident_report=report)
    for spec in config['fields']:
        if spec['kind'] == 'multi_choice':
            relation_name = 'vehicle_types' if config['key'] == 'rca' else 'cases_handled'
            related_model = RoadCrashVehicleType if config['key'] == 'rca' else StandbyMedicalCase
            relation = getattr(record, relation_name)
            relation.all().delete()
            related_model.objects.bulk_create([
                related_model(details=record, value=value, position=index)
                for index, value in enumerate(values.get(spec['name'], []))
            ])
            continue

        value = values.get(spec['name'])
        if value is not None and spec['kind'] == 'time':
            from datetime import time as time_value

            hour, minute = (int(part) for part in str(value).split(':')[:2])
            value = time_value(hour, minute)
        setattr(record, spec['name'], value)
    record.save()


def get_victim_detail_values(victim):
    config = _report_detail_config(victim.incident_report)
    if not config:
        return {}

    model_by_key = {
        'rca': ('road_crash_details', RoadCrashVictimDetails),
        'fire': ('fire_details', FireVictimDetails),
        'medical': ('medical_details', MedicalVictimDetails),
    }
    relation = model_by_key.get(config['key'])
    if not relation:
        return {}
    relation_name, model = relation
    try:
        record = getattr(victim, relation_name)
    except model.DoesNotExist:
        return {}

    values = {}
    for spec in config['victim_fields']:
        value = getattr(record, spec['name'])
        if value is None or value == '':
            continue
        if spec['kind'] == 'decimal':
            values[spec['name']] = float(value)
        else:
            values[spec['name']] = value
    return values


def save_victim_detail_values(victim, values):
    config = _report_detail_config(victim.incident_report)
    model_by_key = {
        'rca': RoadCrashVictimDetails,
        'fire': FireVictimDetails,
        'medical': MedicalVictimDetails,
    }
    model = model_by_key.get(config['key']) if config else None
    for detail_model in model_by_key.values():
        if detail_model is not model:
            detail_model.objects.filter(victim=victim).delete()
    if not model:
        if values:
            raise ValueError(f'No relational victim detail model for incident type {victim.incident_report.incident_type!r}.')
        return

    record, _ = model.objects.get_or_create(victim=victim)
    for spec in config['victim_fields']:
        setattr(record, spec['name'], values.get(spec['name']))
    record.save()


class AccomplishmentReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    compiled_code = models.CharField(max_length=30, unique=True, blank=True)
    title = models.CharField(max_length=100, default='Accomplishment Report')
    incident_reports = models.ManyToManyField(IncidentReport, related_name='accomplishment_reports')
    status = models.CharField(max_length=30, default='Compiled')
    compiled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accomplishment_reports'
        ordering = ['-created_at']

    @property
    def total_reports(self):
        prefetched_reports = getattr(self, '_prefetched_objects_cache', {}).get('incident_reports')
        if prefetched_reports is not None:
            return len(prefetched_reports)
        return self.incident_reports.count()

    def save(self, *args, **kwargs):
        if not self.compiled_code:
            year = timezone.now().year
            last = AccomplishmentReport.objects.filter(
                compiled_code__startswith=f'AR-{year}-'
            ).order_by(Length('compiled_code'), 'compiled_code').last()

            next_num = 1
            if last:
                try:
                    next_num = int(last.compiled_code.split('-')[-1]) + 1
                except ValueError:
                    next_num = 1

            self.compiled_code = f'AR-{year}-{next_num:05d}'

        super().save(*args, **kwargs)