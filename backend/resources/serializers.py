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

    # Computed from capacity / current_occupancy / status (see resources/evacuation.py).
    available_slots = serializers.IntegerField(read_only=True, allow_null=True)
    occupancy_rate = serializers.FloatField(read_only=True, allow_null=True)
    is_accepting_evacuees = serializers.BooleanField(read_only=True)

    class Meta:
        model = EvacuationCenter
        fields = [
            'id', 'name', 'latitude', 'longitude', 'coordinates',
            'address', 'barangay', 'barangay_id', 'capacity',
            'current_occupancy', 'status',
            'available_slots', 'occupancy_rate', 'is_accepting_evacuees',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_coordinates(self, obj):
        return {
            'lat': float(obj.latitude),
            'lng': float(obj.longitude)
        }

    def validate(self, attrs):
        # For partial updates (PATCH), fall back to the values already saved.
        capacity = attrs.get('capacity', getattr(self.instance, 'capacity', 0)) or 0
        occupancy = attrs.get('current_occupancy', getattr(self.instance, 'current_occupancy', 0)) or 0

        if capacity > 0 and occupancy > capacity:
            raise serializers.ValidationError({
                'current_occupancy': f'Current occupancy ({occupancy}) cannot be higher than capacity ({capacity}).',
            })

        return attrs


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