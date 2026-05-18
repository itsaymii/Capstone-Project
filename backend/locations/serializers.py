from rest_framework import serializers
from .models import Barangay, Location, PopulationDensity, EarthquakeFaultLine


class BarangaySerializer(serializers.ModelSerializer):
    coordinates = serializers.SerializerMethodField()
    
    class Meta:
        model = Barangay
        fields = [
            'id', 'name', 'city', 'province', 'population',
            'latitude', 'longitude', 'coordinates',
            'brgy_code', 'reg_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_coordinates(self, obj):
        if obj.latitude and obj.longitude:
            return {
                'lat': float(obj.latitude),
                'lng': float(obj.longitude)
            }
        return None


class BarangayGeoJSONSerializer(serializers.Serializer):
    """For GeoJSON output"""
    id = serializers.UUIDField()
    name = serializers.CharField()
    city = serializers.CharField()
    province = serializers.CharField()
    population = serializers.IntegerField()
    boundary = serializers.JSONField()
    
    def to_representation(self, instance):
        return {
            "type": "Feature",
            "properties": {
                "id": str(instance.id),
                "name": instance.name,
                "city": instance.city,
                "province": instance.province,
                "population": instance.population,
                "brgy_code": instance.brgy_code,
            },
            "geometry": instance.boundary
        }


class LocationSerializer(serializers.ModelSerializer):
    coordinates = serializers.SerializerMethodField()
    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    
    class Meta:
        model = Location
        fields = [
            'id', 'barangay', 'barangay_name',
            'latitude', 'longitude', 'coordinates',
            'address', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_coordinates(self, obj):
        return {
            'lat': float(obj.latitude),
            'lng': float(obj.longitude)
        }


class PopulationDensitySerializer(serializers.ModelSerializer):
    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    
    class Meta:
        model = PopulationDensity
        fields = ['id', 'barangay', 'barangay_name', 'density', 'recorded_at']
        read_only_fields = ['id', 'recorded_at']


class EarthquakeFaultLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = EarthquakeFaultLine
        fields = ['id', 'name', 'coordinates', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']