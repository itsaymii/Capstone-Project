import uuid
from django.db import models
from django.db import transaction
from django.db.models.functions import Lower


class Region(models.Model):
    name = models.CharField(max_length=200)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(Lower('name'), name='locations_region_name_ci_uniq'),
        ]

    def __str__(self):
        return self.name


class Province(models.Model):
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name='provinces')
    name = models.CharField(max_length=200)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(Lower('name'), 'region', name='locations_region_province_uniq'),
        ]

    def __str__(self):
        return self.name


class CityMunicipality(models.Model):
    province = models.ForeignKey(Province, on_delete=models.PROTECT, related_name='cities_municipalities')
    name = models.CharField(max_length=200)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(Lower('name'), 'province', name='locations_province_city_uniq'),
        ]

    def __str__(self):
        return self.name


def get_or_create_city_municipality(city_name='Lucena City', province_name='Quezon', region_name='Region IV-A (CALABARZON)'):
    with transaction.atomic():
        region = Region.objects.filter(name__iexact=region_name).first()
        if region is None:
            region = Region.objects.create(name=region_name)
        province = Province.objects.filter(region=region, name__iexact=province_name).first()
        if province is None:
            province = Province.objects.create(region=region, name=province_name)
        city = CityMunicipality.objects.filter(province=province, name__iexact=city_name).first()
        if city is None:
            city = CityMunicipality.objects.create(province=province, name=city_name)
    return city


class Barangay(models.Model):
    """Administrative division (Barangay level)"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    city_municipality = models.ForeignKey(
        CityMunicipality,
        on_delete=models.PROTECT,
        related_name='barangays',
    )
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'barangays'
        ordering = ['name']
        verbose_name_plural = 'Barangays'
        constraints = [
            models.UniqueConstraint(
                Lower('brgy_code'),
                condition=~models.Q(brgy_code=''),
                name='locations_barangay_code_uniq',
            ),
            models.UniqueConstraint(
                Lower('name'),
                'city_municipality',
                name='locations_city_barangay_name_uniq',
            ),
        ]

    def __str__(self):
        return f"{self.name}, {self.city}"

    @property
    def city(self):
        return self.city_municipality.name

    @city.setter
    def city(self, value):
        self._legacy_city_name = value

    @property
    def province(self):
        return self.city_municipality.province.name

    @province.setter
    def province(self, value):
        self._legacy_province_name = value

    @property
    def reg_name(self):
        return self.city_municipality.province.region.name

    @reg_name.setter
    def reg_name(self, value):
        self._legacy_region_name = value

    def save(self, *args, **kwargs):
        legacy_city = getattr(self, '_legacy_city_name', None)
        legacy_province = getattr(self, '_legacy_province_name', None)
        legacy_region = getattr(self, '_legacy_region_name', None)
        if legacy_city is not None or legacy_province is not None or legacy_region is not None:
            self.city_municipality = get_or_create_city_municipality(
                legacy_city or 'Lucena City',
                legacy_province or 'Quezon',
                legacy_region or 'Region IV-A (CALABARZON)',
            )
            for name in ('_legacy_city_name', '_legacy_province_name', '_legacy_region_name'):
                if hasattr(self, name):
                    delattr(self, name)
        elif not self.city_municipality_id:
            self.city_municipality = get_or_create_city_municipality()
        if kwargs.get('update_fields') is not None:
            update_fields = set(kwargs['update_fields'])
            if update_fields & {'city', 'province', 'reg_name'}:
                update_fields.difference_update({'city', 'province', 'reg_name'})
                update_fields.add('city_municipality')
                kwargs['update_fields'] = update_fields
        super().save(*args, **kwargs)

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