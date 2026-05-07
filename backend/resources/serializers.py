from rest_framework import serializers
from .models import SupplyCategory, Supply, EvacuationCenter, Equipment, Volunteer
from locations.serializers import BarangaySerializer

class SupplyCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplyCategory
        fields = ['id', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SupplySerializer(serializers.ModelSerializer):
    category = SupplyCategorySerializer(read_only=True)
    category_id = serializers.UUIDField(write_only=True, required=False)
    
    class Meta:
        model = Supply
        fields = [
            'id', 'name', 'category', 'category_id',
            'quantity', 'unit', 'status',
            'storage_location', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EvacuationCenterSerializer(serializers.ModelSerializer):
    barangay = BarangaySerializer(read_only=True)
    barangay_id = serializers.UUIDField(write_only=True, required=False)
    coordinates = serializers.SerializerMethodField()
    
    class Meta:
        model = EvacuationCenter
        fields = [
            'id', 'name', 'latitude', 'longitude', 'coordinates',
            'address', 'barangay', 'barangay_id',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_coordinates(self, obj):
        return {
            'lat': float(obj.latitude),
            'lng': float(obj.longitude)
        }


class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = [
            'id', 'name', 'equipment_type', 'description',
            'serial_number', 'asset_number', 'status',
            'location', 'last_maintenance', 'next_maintenance',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class VolunteerSerializer(serializers.ModelSerializer):
    barangay = BarangaySerializer(read_only=True)
    barangay_id = serializers.UUIDField(write_only=True, required=False)
    
    class Meta:
        model = Volunteer
        fields = [
            'id', 'user', 'full_name', 'contact_number',
            'email', 'address', 'barangay', 'barangay_id',
            'skills', 'certifications', 'status',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']