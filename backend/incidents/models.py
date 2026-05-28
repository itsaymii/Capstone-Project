import uuid
from django.db import models, transaction
from django.conf import settings
from django.utils import timezone


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
        """Lookup incident by INC-XXXX format OR UUID"""
        import re
        # Check if it's INC-YYYY-NNN format
        if re.match(r'^INC-\d{4}-\d{3}$', str(value).upper()):
            return self.get(reference_code=value.upper())
        # Otherwise treat as UUID
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
        editable=False,
        db_index=True,  # ✅ Fast lookups
        help_text="Format: INC-YYYY-NNN (e.g., INC-2025-001)"
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
        # ✅ Auto-generate reference_code ONLY on create
        if not self.reference_code and not self.pk:
            with transaction.atomic():
                year = self.incident_datetime.year if self.incident_datetime else timezone.now().year
                # Lock table for safe sequence generation
                last = Incident.objects.select_for_update().filter(
                    reference_code__startswith=f'INC-{year}-'
                ).order_by('reference_code').last()
                
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
    vehicle_types = models.TextField(blank=True, help_text="Comma-separated list")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'vehicular_accidents'
    def __str__(self): return f"Accident: {self.incident.reference_code}"


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
    # ✅ Now looks cleaner with reference_code in __str__
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='responder_reports')
    responder = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reports')
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