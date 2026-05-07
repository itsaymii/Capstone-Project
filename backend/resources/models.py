import uuid
from django.db import models
from django.conf import settings


class SupplyCategory(models.Model):
    """Categories for organizing supplies"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'supply_categories'
        ordering = ['name']
        verbose_name_plural = 'Supply Categories'

    def __str__(self):
        return self.name


class Supply(models.Model):
    """DRRMO inventory of relief supplies"""
    
    UNIT_CHOICES = [
        ('pack', 'Pack'),
        ('box', 'Box'),
        ('kg', 'Kilograms'),
        ('liter', 'Liters'),
        ('piece', 'Pieces'),
        ('set', 'Sets'),
        ('bottle', 'Bottles'),
        ('sack', 'Sacks'),
    ]

    STATUS_CHOICES = [
        ('available', 'Available'),
        ('in_use', 'In Use'),
        ('depleted', 'Depleted'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(
        SupplyCategory,
        on_delete=models.SET_NULL,
        null=True,
        related_name='supplies'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    
    # Storage location (warehouse/DRRMO office)
    storage_location = models.CharField(max_length=200, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'supplies'
        ordering = ['category', 'name']
        indexes = [
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.quantity} {self.unit})"


class EvacuationCenter(models.Model):
    """Evacuation centers/shelters"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    
    # Location
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    address = models.TextField()
    barangay = models.ForeignKey(
        'locations.Barangay',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='evacuation_centers'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'evacuation_centers'
        ordering = ['name']

    def __str__(self):
        return self.name

    def get_coordinates(self):
        """Return coordinates as dict for frontend"""
        return {
            'lat': float(self.latitude),
            'lng': float(self.longitude)
        }


class Equipment(models.Model):
    """DRRMO rescue and response equipment"""
    
    TYPE_CHOICES = [
        ('vehicle', 'Vehicle'),
        ('rescue_gear', 'Rescue Gear'),
        ('communication', 'Communication Equipment'),
        ('medical', 'Medical Equipment'),
        ('firefighting', 'Firefighting Equipment'),
        ('water_rescue', 'Water Rescue Equipment'),
        ('power', 'Power Generation'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('available', 'Available'),
        ('in_use', 'In Use'),
        ('maintenance', 'Under Maintenance'),
        ('damaged', 'Damaged'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    equipment_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    description = models.TextField(blank=True)
    
    # Identification
    serial_number = models.CharField(max_length=100, blank=True)
    asset_number = models.CharField(max_length=100, blank=True, unique=True)
    
    # Status tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    location = models.CharField(max_length=200, blank=True, help_text="Current storage location")
    
    # Maintenance
    last_maintenance = models.DateField(null=True, blank=True)
    next_maintenance = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'equipment'
        ordering = ['equipment_type', 'name']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['equipment_type']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"


class Volunteer(models.Model):
    """Community volunteers for disaster response"""
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('on_deployment', 'On Deployment'),
    ]

    SKILL_CHOICES = [
        ('medical', 'Medical/First Aid'),
        ('rescue', 'Search and Rescue'),
        ('logistics', 'Logistics/Supply'),
        ('communication', 'Communication'),
        ('counseling', 'Psychological Support'),
        ('driving', 'Driving'),
        ('general', 'General Support'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='volunteer_profile'
    )
    
    # Personal info
    full_name = models.CharField(max_length=200)
    contact_number = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    address = models.TextField()
    barangay = models.ForeignKey(
        'locations.Barangay',
        on_delete=models.SET_NULL,
        null=True,
        related_name='volunteers'
    )
    
    # Skills
    skills = models.JSONField(default=list, help_text="List of skill codes")
    certifications = models.TextField(blank=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'volunteers'
        ordering = ['full_name']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['barangay']),
        ]

    def __str__(self):
        return f"{self.full_name} (Volunteer)"