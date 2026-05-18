import uuid
from django.db import models
from django.conf import settings


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


class Incident(models.Model):
    """Core incident table - all disaster types link here"""
    
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('moderate', 'Moderate'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    STATUS_CHOICES = [
        ('reported', 'Reported'),
        ('verified', 'Verified'),
        ('ongoing', 'Ongoing'),
        ('contained', 'Contained'),
        ('resolved', 'Resolved'),
        ('false_alarm', 'False Alarm'),
    ]

    IMPACT_CHOICES = [
        ('minimal', 'Minimal'),
        ('minor', 'Minor'),
        ('major', 'Major'),
        ('severe', 'Severe'),
        ('catastrophic', 'Catastrophic'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hazard_type = models.ForeignKey(
        HazardType,
        on_delete=models.PROTECT,
        related_name='incidents'
    )
    
    # Location reference (from locations app)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    address = models.TextField(blank=True)
    barangay = models.ForeignKey(
        'locations.Barangay',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incidents'
    )
    
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='reported_incidents'
    )
    date_reported = models.DateTimeField(auto_now_add=True)
    incident_datetime = models.DateTimeField()
    severity_level = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='reported')
    impact_level = models.CharField(max_length=20, choices=IMPACT_CHOICES, default='minimal')
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'incidents'
        ordering = ['-incident_datetime']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['severity_level']),
            models.Index(fields=['incident_datetime']),
        ]

    def __str__(self):
        return f"{self.hazard_type.name} - {self.status} ({self.incident_datetime})"

    def get_coordinates(self):
        """Return coordinates as dict for frontend"""
        return {
            'lat': float(self.latitude),
            'lng': float(self.longitude)
        }


class FireDetails(models.Model):
    """Fire-specific incident data"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(
        Incident,
        on_delete=models.CASCADE,
        related_name='fire_details'
    )
    cause = models.CharField(max_length=200, blank=True)
    damage_estimate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    casualties = models.IntegerField(default=0)
    injuries = models.IntegerField(default=0)
    structures_affected = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fire_details'

    def __str__(self):
        return f"Fire: {self.incident}"


class EarthquakeDetails(models.Model):
    """Earthquake-specific data"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(
        Incident,
        on_delete=models.CASCADE,
        related_name='earthquake_details'
    )
    magnitude = models.DecimalField(max_digits=3, decimal_places=1)
    depth = models.DecimalField(max_digits=6, decimal_places=2, help_text="Depth in km")
    intensity = models.CharField(max_length=50, blank=True, help_text="PEIS intensity scale")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'earthquake_details'

    def __str__(self):
        return f"Earthquake: M{self.magnitude}"


class VehicularAccident(models.Model):
    """Accident-specific data"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(
        Incident,
        on_delete=models.CASCADE,
        related_name='vehicular_accident_details'
    )
    vehicles_involved = models.IntegerField(default=1)
    casualties = models.IntegerField(default=0)
    injuries = models.IntegerField(default=0)
    cause = models.CharField(max_length=200, blank=True)
    vehicle_types = models.TextField(blank=True, help_text="Comma-separated list")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vehicular_accidents'

    def __str__(self):
        return f"Accident: {self.incident}"


class CrimeReport(models.Model):
    """Crime-specific data"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(
        Incident,
        on_delete=models.CASCADE,
        related_name='crime_details'
    )
    crime_type = models.CharField(max_length=100)
    suspects = models.IntegerField(default=0)
    victims = models.IntegerField(default=0)
    arrested = models.BooleanField(default=False)
    case_status = models.CharField(max_length=50, default='under_investigation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crime_reports'

    def __str__(self):
        return f"Crime: {self.crime_type}"


class MedicalEmergency(models.Model):
    """Medical emergency data"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(
        Incident,
        on_delete=models.CASCADE,
        related_name='medical_details'
    )
    patient_count = models.IntegerField(default=1)
    emergency_type = models.CharField(max_length=100)
    transported = models.IntegerField(default=0, help_text="Number transported to hospital")
    hospital = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'medical_emergencies'

    def __str__(self):
        return f"Medical: {self.emergency_type}"


class DrowningIncident(models.Model):
    """Drowning incident data"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(
        Incident,
        on_delete=models.CASCADE,
        related_name='drowning_details'
    )
    victims = models.IntegerField(default=0)
    rescued = models.IntegerField(default=0)
    fatalities = models.IntegerField(default=0)
    water_body = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'drowning_incidents'

    def __str__(self):
        return f"Drowning: {self.incident}"


class Alert(models.Model):
    """Public alert system"""
    
    ALERT_TYPE_CHOICES = [
        ('warning', 'Warning'),
        ('evacuation', 'Evacuation Order'),
        ('all_clear', 'All Clear'),
        ('advisory', 'Advisory'),
    ]

    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(
        Incident,
        on_delete=models.CASCADE,
        related_name='alerts'
    )
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPE_CHOICES)
    message = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    is_active = models.BooleanField(default=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'alerts'
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['is_active']),
            models.Index(fields=['alert_type']),
        ]

    def __str__(self):
        return f"{self.alert_type} - {self.sent_at}"


class ResponderReport(models.Model):
    """Field reports from responders"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(
        Incident,
        on_delete=models.CASCADE,
        related_name='responder_reports'
    )
    responder = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reports'
    )
    report_time = models.DateTimeField(auto_now_add=True)
    report_text = models.TextField()
    action_taken = models.TextField(blank=True)
    media_url = models.URLField(blank=True, help_text="Photo/video URL")
    status_update = models.CharField(max_length=50, default='ongoing')

    class Meta:
        db_table = 'responder_reports'
        ordering = ['-report_time']
        indexes = [
            models.Index(fields=['report_time']),
        ]

    def __str__(self):
        return f"Report by {self.responder} on {self.incident}"