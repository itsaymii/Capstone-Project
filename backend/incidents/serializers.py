from rest_framework import serializers
from .models import (
    HazardType, Incident, FireDetails, EarthquakeDetails,
    VehicularAccident, CrimeReport, MedicalEmergency,
    DrowningIncident, Alert, ResponderReport, 
)
from locations.serializers import BarangaySerializer

class HazardTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = HazardType
        fields = ['id', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class FireDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FireDetails
        fields = ['id', 'cause', 'damage_estimate', 'casualties', 
                  'injuries', 'structures_affected', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class EarthquakeDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = EarthquakeDetails
        fields = ['id', 'magnitude', 'depth', 'intensity', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class VehicularAccidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicularAccident
        fields = ['id', 'vehicles_involved', 'casualties', 'injuries',
                  'cause', 'vehicle_types', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CrimeReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrimeReport
        fields = ['id', 'crime_type', 'suspects', 'victims',
                  'arrested', 'case_status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class MedicalEmergencySerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalEmergency
        fields = ['id', 'patient_count', 'emergency_type',
                  'transported', 'hospital', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DrowningIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DrowningIncident
        fields = ['id', 'victims', 'rescued', 'fatalities',
                  'water_body', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AlertSerializer(serializers.ModelSerializer):
    incident_id = serializers.UUIDField(source='incident.id', read_only=True)
    
    class Meta:
        model = Alert
        fields = ['id', 'incident_id', 'alert_type', 'message',
                  'severity', 'is_active', 'sent_at', 'expires_at']
        read_only_fields = ['id', 'sent_at']


class ResponderReportSerializer(serializers.ModelSerializer):
    responder_username = serializers.CharField(source='responder.username', read_only=True)
    incident_id = serializers.UUIDField(source='incident.id', read_only=True)
    
    class Meta:
        model = ResponderReport
        fields = ['id', 'incident_id', 'responder', 'responder_username',
                  'report_time', 'report_text', 'action_taken',
                  'media_url', 'status_update']
        read_only_fields = ['id', 'report_time', 'responder']


class IncidentSerializer(serializers.ModelSerializer):
    hazard_type = HazardTypeSerializer(read_only=True)
    hazard_type_id = serializers.UUIDField(write_only=True)
    barangay = BarangaySerializer(read_only=True)
    barangay_id = serializers.UUIDField(write_only=True, required=False)
    reported_by_username = serializers.CharField(source='reported_by.username', read_only=True)
    coordinates = serializers.SerializerMethodField()
    
    # Detail serializers (read-only)
    fire_details = FireDetailsSerializer(read_only=True)
    earthquake_details = EarthquakeDetailsSerializer(read_only=True)
    vehicular_accident_details = VehicularAccidentSerializer(read_only=True)
    crime_details = CrimeReportSerializer(read_only=True)
    medical_details = MedicalEmergencySerializer(read_only=True)
    drowning_details = DrowningIncidentSerializer(read_only=True)
    
    class Meta:
        model = Incident
        fields = [
            'id', 'hazard_type', 'hazard_type_id',
            'latitude', 'longitude', 'coordinates',
            'address', 'barangay', 'barangay_id',
            'reported_by_username', 'date_reported',
            'incident_datetime', 'severity_level',
            'status', 'impact_level', 'description',
            'fire_details', 'earthquake_details',
            'vehicular_accident_details', 'crime_details',
            'medical_details', 'drowning_details',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'date_reported', 'created_at', 'updated_at']
    
    def get_coordinates(self, obj):
        return {
            'lat': float(obj.latitude),
            'lng': float(obj.longitude)
        }
    
    def create(self, validated_data):
        # Extract foreign key IDs
        hazard_type_id = validated_data.pop('hazard_type_id')
        barangay_id = validated_data.pop('barangay_id', None)
        
        # Get related objects
        validated_data['hazard_type_id'] = hazard_type_id
        if barangay_id:
            validated_data['barangay_id'] = barangay_id
        
        # Set reported_by to current user
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['reported_by'] = request.user
        
        return super().create(validated_data)