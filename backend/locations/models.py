import uuid
from django.db import models


class Barangay(models.Model):
    """Administrative division (Barangay level)"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    city = models.CharField(max_length=200, default='Lucena City')
    province = models.CharField(max_length=200, default='Quezon')
    population = models.IntegerField(default=0)
    
    # ✅ Store GeoJSON geometry as JSON (Polygon/MultiPolygon)
    boundary = models.JSONField(
        null=True, 
        blank=True,
        help_text="GeoJSON geometry (Polygon/MultiPolygon)"
    )
    
    # Centroid for quick display and calculations
    latitude = models.DecimalField(
        max_digits=9, 
        decimal_places=6, 
        null=True, 
        blank=True,
        help_text="Centroid latitude"
    )
    longitude = models.DecimalField(
        max_digits=9, 
        decimal_places=6, 
        null=True, 
        blank=True,
        help_text="Centroid longitude"
    )
    
    # Additional metadata from GeoJSON
    brgy_code = models.CharField(max_length=50, blank=True)
    reg_name = models.CharField(max_length=200, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'barangays'
        ordering = ['name']
        verbose_name_plural = 'Barangays'

    def __str__(self):
        return f"{self.name}, {self.city}"

    def get_coordinates(self):
        """Return centroid as dict for frontend"""
        if self.latitude and self.longitude:
            return {
                'lat': float(self.latitude),
                'lng': float(self.longitude)
            }
        return None


class Location(models.Model):
    """Specific geographic point (lat/long, address)"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    barangay = models.ForeignKey(
        Barangay,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='locations'
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'locations'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return self.address or f"Location {self.id}"

    def get_coordinates(self):
        """Return coordinates as dict for frontend"""
        return {
            'lat': float(self.latitude),
            'lng': float(self.longitude)
        }


class PopulationDensity(models.Model):
    """Population density data per barangay"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    barangay = models.ForeignKey(
        Barangay,
        on_delete=models.CASCADE,
        related_name='population_density_records'
    )
    density = models.DecimalField(max_digits=10, decimal_places=2)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'population_density'
        ordering = ['-recorded_at']
        verbose_name_plural = 'Population Density Records'
        unique_together = ['barangay', 'recorded_at']

    def __str__(self):
        return f"{self.barangay.name} - {self.density} per sq km"


class EarthquakeFaultLine(models.Model):
    """Geographic hazard data - earthquake fault lines"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    
    # ✅ Store as GeoJSON LineString
    coordinates = models.JSONField(
        help_text="GeoJSON LineString: {'type': 'LineString', 'coordinates': [[lng,lat], ...]}"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'earthquake_fault_lines'
        ordering = ['name']

    def __str__(self):
        return self.name

    def get_coordinates(self):
        """Return coordinates for frontend"""
        return self.coordinates