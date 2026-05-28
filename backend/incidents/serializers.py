from rest_framework import serializers
from .models import (
    HazardType, Incident, FireDetails, EarthquakeDetails,
    VehicularAccident, CrimeReport, MedicalEmergency,
    DrowningIncident, Alert, ResponderReport, 
)
from locations.serializers import BarangaySerializer
import re


class HazardTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = HazardType
        fields = ['id', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class FireDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FireDetails
        fields = ['id', 'cause', 'damage_estimate', 'casualties', 'injuries', 'structures_affected', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class EarthquakeDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = EarthquakeDetails
        fields = ['id', 'magnitude', 'depth', 'intensity', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class VehicularAccidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicularAccident
        fields = ['id', 'vehicles_involved', 'casualties', 'injuries', 'cause', 'vehicle_types', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CrimeReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrimeReport
        fields = ['id', 'crime_type', 'suspects', 'victims', 'arrested', 'case_status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class MedicalEmergencySerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalEmergency
        fields = ['id', 'patient_count', 'emergency_type', 'transported', 'hospital', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DrowningIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DrowningIncident
        fields = ['id', 'victims', 'rescued', 'fatalities', 'water_body', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AlertSerializer(serializers.ModelSerializer):
    incident_id = serializers.UUIDField(source='incident.id', read_only=True)
    incident_reference_code = serializers.CharField(source='incident.reference_code', read_only=True)
    
    class Meta:
        model = Alert
        fields = ['id', 'incident_id', 'incident_reference_code', 'alert_type', 'message', 'severity', 'is_active', 'sent_at', 'expires_at']
        read_only_fields = ['id', 'sent_at', 'incident_reference_code']


class ResponderReportSerializer(serializers.ModelSerializer):
    # ✅ PRIMARY CHANGE: Use reference_code (INC-1001) instead of UUID for input
    incident_reference_code = serializers.CharField(
        write_only=True, 
        required=True,
        help_text="Enter incident reference code (e.g., INC-2025-001)"
    )
    incident_id = serializers.UUIDField(source='incident.id', read_only=True)
    incident_reference_code_readonly = serializers.CharField(
        source='incident.reference_code', 
        read_only=True
    )
    responder_username = serializers.CharField(source='responder.username', read_only=True)
    
    class Meta:
        model = ResponderReport
        fields = [
            'id', 'incident_reference_code', 'incident_id', 'incident_reference_code_readonly',
            'responder', 'responder_username', 'report_time', 'report_text', 
            'action_taken', 'media_url', 'status_update'
        ]
        read_only_fields = ['id', 'report_time', 'responder', 'incident_id', 'incident_reference_code_readonly']

    def validate_incident_reference_code(self, value):
        """Lookup Incident by INC-YYYY-NNN format (case-insensitive)"""
        # Normalize to uppercase: inc-1001 → INC-1001
        normalized = value.upper().strip()
        
        # Validate format
        if not re.match(r'^INC-\d{4}-\d{3}$', normalized):
            raise serializers.ValidationError(
                "Invalid format. Use INC-YYYY-NNN (e.g., INC-2025-001)"
            )
        
        # Lookup incident
        try:
            return Incident.objects.get(reference_code=normalized)
        except Incident.DoesNotExist:
            raise serializers.ValidationError(
                f"Incident '{normalized}' not found. Please select from Dispatch Ledger."
            )

    def create(self, validated_data):
        # Map incident_reference_code to incident field
        incident = validated_data.pop('incident_reference_code')
        validated_data['incident'] = incident
        return super().create(validated_data)


class IncidentSerializer(serializers.ModelSerializer):
    hazard_type = HazardTypeSerializer(read_only=True)
    hazard_type_id = serializers.UUIDField(write_only=True)
    barangay = BarangaySerializer(read_only=True)
    barangay_id = serializers.UUIDField(write_only=True, required=False)
    reported_by_username = serializers.CharField(source='reported_by.username', read_only=True)
    coordinates = serializers.SerializerMethodField()
    
    # ✅ EXPOSE reference_code prominently
    reference_code = serializers.CharField(read_only=True)
    
    fire_details = FireDetailsSerializer(read_only=True)
    earthquake_details = EarthquakeDetailsSerializer(read_only=True)
    vehicular_accident_details = VehicularAccidentSerializer(read_only=True)
    crime_details = CrimeReportSerializer(read_only=True)
    medical_details = MedicalEmergencySerializer(read_only=True)
    drowning_details = DrowningIncidentSerializer(read_only=True)
    
    class Meta:
        model = Incident
        fields = [
            'id', 'reference_code', 'hazard_type', 'hazard_type_id',
            'latitude', 'longitude', 'coordinates', 'address', 'barangay', 'barangay_id',
            'reported_by_username', 'date_reported', 'incident_datetime', 'severity_level',
            'status', 'impact_level', 'description', 'fire_details', 'earthquake_details',
            'vehicular_accident_details', 'crime_details', 'medical_details', 'drowning_details',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'reference_code', 'date_reported', 'created_at', 'updated_at']
    
    def get_coordinates(self, obj):
        return {'lat': float(obj.latitude), 'lng': float(obj.longitude)}
    
    def create(self, validated_data):
        hazard_type_id = validated_data.pop('hazard_type_id')
        barangay_id = validated_data.pop('barangay_id', None)
        validated_data['hazard_type_id'] = hazard_type_id
        if barangay_id:
            validated_data['barangay_id'] = barangay_id
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['reported_by'] = request.user
        return super().create(validated_data)