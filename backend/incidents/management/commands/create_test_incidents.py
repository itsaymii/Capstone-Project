from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from incidents.models import (
    HazardType, Incident, FireDetails, MedicalEmergency,
    VehicularAccident, EarthquakeDetails, CrimeReport,
    DrowningIncident
)
from locations.models import Barangay
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create legitimate test incident data with all related details'

    def handle(self, *args, **options):
        self.stdout.write("Creating test incident data...")
        
        # Get or create hazard types - matching the form categories
        rca_type, _ = HazardType.objects.get_or_create(
            name='RCA',
            defaults={'description': 'Root Cause Analysis'}
        )
        fire_type, _ = HazardType.objects.get_or_create(
            name='Fire Incident',
            defaults={'description': 'Fire incident or structure fire'}
        )
        crime_type, _ = HazardType.objects.get_or_create(
            name='Crime Against Person/Property',
            defaults={'description': 'Crime-related incident'}
        )
        medical_type, _ = HazardType.objects.get_or_create(
            name='Medical Emergency',
            defaults={'description': 'Medical emergency or injury'}
        )
        ambulance_type, _ = HazardType.objects.get_or_create(
            name='Ambulance Assistance',
            defaults={'description': 'Ambulance assistance required'}
        )
        medical_team_type, _ = HazardType.objects.get_or_create(
            name='Stand-by Medical Team',
            defaults={'description': 'Stand-by medical team deployment'}
        )
        drowning_type, _ = HazardType.objects.get_or_create(
            name='Drowning',
            defaults={'description': 'Water-related drowning incident'}
        )
        
        # Get or create barangays (sample barangays)
        barangay1, _ = Barangay.objects.get_or_create(
            name='Barangay 1',
            defaults={'brgy_code': 'BRG001', 'city': 'Lucena City', 'province': 'Quezon'}
        )
        barangay2, _ = Barangay.objects.get_or_create(
            name='Barangay 2',
            defaults={'brgy_code': 'BRG002', 'city': 'Lucena City', 'province': 'Quezon'}
        )
        barangay3, _ = Barangay.objects.get_or_create(
            name='Barangay 3',
            defaults={'brgy_code': 'BRG003', 'city': 'Lucena City', 'province': 'Quezon'}
        )
        
        # Get staff user for reported_by
        staff_user = User.objects.filter(is_staff=True).first()
        if not staff_user:
            staff_user = User.objects.create_user(
                username='reporter',
                password='testpass123',
                is_staff=True
            )
        
        now = timezone.now()
        base_time = now - timedelta(hours=24)
        
        # Sample incidents to create - matching form categories
        incidents_data = [
            {
                'title': 'Structure Fire at Commercial Building',
                'hazard_type': fire_type,
                'latitude': 14.3557,
                'longitude': 121.0244,
                'address': '123 Mabini Street, Lucena City',
                'barangay': barangay1,
                'description': 'Large fire reported at multi-story commercial building. Emergency services dispatched.',
                'severity_level': 'high',
                'status': 'ongoing',
                'impact_level': 'major',
                'incident_datetime': base_time,
                'details_model': FireDetails,
                'details_data': {
                    'cause': 'Electrical fault',
                    'damage_estimate': '500000.00',
                    'casualties': 2,
                    'injuries': 5,
                    'structures_affected': 1
                }
            },
            {
                'title': 'Medical Emergency - Multiple Patients',
                'hazard_type': medical_type,
                'latitude': 14.3545,
                'longitude': 121.0255,
                'address': '456 Quezon Avenue, Lucena City',
                'barangay': barangay2,
                'description': 'Multiple patients requiring emergency medical attention. Ambulances en route.',
                'severity_level': 'critical',
                'status': 'verified',
                'impact_level': 'severe',
                'incident_datetime': base_time + timedelta(hours=2),
                'details_model': MedicalEmergency,
                'details_data': {
                    'patient_count': 8,
                    'emergency_type': 'Mass Casualty - Building Collapse',
                    'transported': 6,
                    'hospital': 'Lucena Doctor\'s Hospital'
                }
            },
            {
                'title': 'Crime Report - Robbery at Store',
                'hazard_type': crime_type,
                'latitude': 14.3565,
                'longitude': 121.0280,
                'address': '789 Salcedo Street, Lucena City',
                'barangay': barangay2,
                'description': 'Armed robbery reported at convenience store. Suspects fled the scene.',
                'severity_level': 'moderate',
                'status': 'reported',
                'impact_level': 'minor',
                'incident_datetime': base_time + timedelta(hours=3),
                'details_model': CrimeReport,
                'details_data': {
                    'crime_type': 'Armed Robbery',
                    'suspects': 2,
                    'victims': 1,
                    'arrested': False,
                    'case_status': 'under_investigation'
                }
            },
            {
                'title': 'Ambulance Assistance Required',
                'hazard_type': ambulance_type,
                'latitude': 14.3600,
                'longitude': 121.0300,
                'address': 'National Highway, Km 32, Lucena City',
                'barangay': barangay3,
                'description': 'Accident victim requiring ambulance assistance to hospital.',
                'severity_level': 'moderate',
                'status': 'contained',
                'impact_level': 'major',
                'incident_datetime': base_time + timedelta(hours=4),
                'details_model': MedicalEmergency,
                'details_data': {
                    'patient_count': 1,
                    'emergency_type': 'Vehicle Accident - Patient Transport',
                    'transported': 1,
                    'hospital': 'Quezon Medical Center'
                }
            },
            {
                'title': 'Stand-by Medical Team Deployment',
                'hazard_type': medical_team_type,
                'latitude': 14.3500,
                'longitude': 121.0200,
                'address': 'Community Event Venue, Lucena City',
                'barangay': barangay1,
                'description': 'Stand-by medical team deployed for large community event.',
                'severity_level': 'low',
                'status': 'verified',
                'impact_level': 'minimal',
                'incident_datetime': base_time + timedelta(hours=5),
                'details_model': MedicalEmergency,
                'details_data': {
                    'patient_count': 0,
                    'emergency_type': 'Standby - Event Medical Coverage',
                    'transported': 0,
                    'hospital': 'Standby Position'
                }
            },
            {
                'title': 'Drowning Incident at Beach',
                'hazard_type': drowning_type,
                'latitude': 14.3700,
                'longitude': 121.0150,
                'address': 'Dalahican Beach, Lucena City',
                'barangay': barangay3,
                'description': 'Drowning incident at public beach. Rescue operation underway.',
                'severity_level': 'critical',
                'status': 'ongoing',
                'impact_level': 'severe',
                'incident_datetime': base_time + timedelta(hours=6),
                'details_model': DrowningIncident,
                'details_data': {
                    'victims': 1,
                    'rescued': 0,
                    'fatalities': 0,
                    'water_body': 'Dalahican Beach'
                }
            },
            {
                'title': 'RCA - Incident Root Cause Analysis',
                'hazard_type': rca_type,
                'latitude': 14.3520,
                'longitude': 121.0210,
                'address': 'Emergency Operations Center, Lucena City',
                'barangay': barangay1,
                'description': 'Root cause analysis being conducted for previous incident.',
                'severity_level': 'moderate',
                'status': 'reported',
                'impact_level': 'minor',
                'incident_datetime': base_time + timedelta(hours=7),
                'details_model': CrimeReport,
                'details_data': {
                    'crime_type': 'Analysis',
                    'suspects': 0,
                    'victims': 0,
                    'arrested': False,
                    'case_status': 'analysis'
                }
            }
        ]
        
        created_count = 0
        for incident_data in incidents_data:
            # Separate details data
            details_model = incident_data.pop('details_model')
            details_data = incident_data.pop('details_data')
            
            # Create incident
            incident, created = Incident.objects.get_or_create(
                address=incident_data['address'],
                incident_datetime=incident_data['incident_datetime'],
                defaults={
                    **incident_data,
                    'reported_by': staff_user
                }
            )
            
            if created:
                created_count += 1
                # Create related details
                details_data['incident'] = incident
                details_model.objects.get_or_create(
                    incident=incident,
                    defaults=details_data
                )
                self.stdout.write(
                    self.style.SUCCESS(f"✓ Created: {incident_data.get('address', 'Unknown')}")
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f"◆ Already exists: {incident_data.get('address', 'Unknown')}")
                )
        
        self.stdout.write(
            self.style.SUCCESS(f"\n✓ Successfully created {created_count} test incidents with detailed data")
        )
