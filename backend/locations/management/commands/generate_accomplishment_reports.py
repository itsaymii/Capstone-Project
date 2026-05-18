# backend/management/commands/generate_accomplishment_reports.py
import random
import uuid
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from faker import Faker
from decimal import Decimal

from locations.models import Barangay
from incidents.models import HazardType, Incident, VehicularAccident, MedicalEmergency, FireDetails, ResponderReport
# from resources.models import Volunteer

# Philippine-aware Faker
fake = Faker('fil_PH')  # Fallback to English for medical terms

TEAMS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA']
RESPONDERS = [
    "MENARD B. ATANACIO", "CARLOS MENDOZA", "BANJO PAULO",
    "DARWIN SOLOMON", "CYRIL HOLGADO", "GIOVANNI BUNCHA",
    "MARBIEN DE JUAN II", "ANGELO CARLOS GLORIOSO", "HENRY JALLA"
]
HOSPITALS = ["Quezon Medical Center (QMC)", "Lucena City Hospital", "St. Luke's Lucena", "Home/Refused Transfer"]
VEHICLES = ["Motorcycle", "Tricycle", "E-bike", "Pick-up Hilux", "Sedan", "Jeepney", "Bus"]
INJURIES = [
    "Contusion on Head", "Fractured Right Knee Cap", "Aberasion on Arms", 
    "Laceration on Forehead", "Sprained Ankle", "Minor Burns", "Concussion Suspected",
    "Chest Pain", "Difficulty Breathing", "Heat Exhaustion"
]
ACTIONS = [
    "First aid management, splinting and transported to {hospital}",
    "Oxygen administration, IV fluid started, transported to {hospital}",
    "Wound cleaning, bandaging, patient refused hospital transfer",
    "CPR initiated, ROSC achieved, transported to {hospital}",
    "Triage completed, minor injuries treated on-site"
]

class Command(BaseCommand):
    help = 'Generate ~1000 realistic accomplishment report entries based on real DRRMO templates'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=1000, help='Number of reports to generate')
        parser.add_argument('--days', type=int, default=180, help='Spread over X days')
        parser.add_argument('--export-daily', action='store_true', help='Export daily accomplishment reports as text files')

    def handle(self, *args, **options):
        count = options['count']
        days = options['days']
        export = options['export_daily']

        self.stdout.write(f'📊 Generating {count} reports over {days} days...')
        
        # Load existing data
        barangays = list(Barangay.objects.all())
        if not barangays:
            self.stdout.write(self.style.ERROR(' No barangays found. Run import_barangays first.'))
            return
            
        hazards = HazardType.objects.filter(name__in=[
            'Vehicular Accident', 'Medical Emergency', 'Fire', 'Crime', 'Drowning'
        ])
        if hazards.count() < 3:
            self.stdout.write(self.style.WARNING('⚠️  Creating missing hazard types...'))
            for name in ['Vehicular Accident', 'Medical Emergency', 'Fire', 'Crime', 'Drowning']:
                HazardType.objects.get_or_create(name=name)
            hazards = HazardType.objects.filter(name__in=[name for name in ['Vehicular Accident', 'Medical Emergency', 'Fire', 'Crime', 'Drowning']])

        self.stdout.write('⏳ Generating records (this may take 10-20 seconds)...')

        # Ensure we have staff users to assign as responders
        from django.contrib.auth import get_user_model
        User = get_user_model()
        responder_pool = list(User.objects.filter(is_staff=True))
        if not responder_pool:
            # Create a default responder account if none exist
            u = User.objects.create_user('field_responder', 'responder@drms.local', 'Demo1234!', is_staff=True)
            responder_pool = [u]

        with transaction.atomic():
            incidents = []
            details = []
            reports = []
            
            start_date = timezone.now() - timedelta(days=days)
            
            for i in range(count):
                # Realistic time distribution (more incidents 18:00-22:00)
                day_offset = random.randint(0, days-1)
                hour = random.choices(range(24), weights=[
                    1,1,1,1,1,2,  # 00-05
                    3,4,5,4,3,2,  # 06-11
                    2,3,4,5,6,7,  # 12-17
                    8,9,8,7,6,5   # 18-23
                ])[0]
                minute = random.randint(0, 59)
                incident_time = start_date + timedelta(days=day_offset, hours=hour, minutes=minute)
                
                brgy = random.choice(barangays)
                lat = float(brgy.latitude) + random.uniform(-0.008, 0.008)
                lng = float(brgy.longitude) + random.uniform(-0.008, 0.008)
                
                # Hazard type distribution
                hazard = random.choices(hazards, weights=[40, 35, 10, 8, 7])[0]
                
                # Severity & status
                severity = random.choices(['low', 'moderate', 'high', 'critical'], weights=[45, 35, 15, 5])[0]
                status = random.choices(['resolved', 'contained', 'ongoing', 'reported'], weights=[50, 25, 15, 10])[0]
                
                # Victim/Condition
                victim_name = fake.name()
                victim_age = random.randint(2, 85)
                victim_sex = random.choice(['M', 'F'])
                injury = random.choice(INJURIES)
                hospital = random.choice(HOSPITALS)
                action = random.choice(ACTIONS).format(hospital=hospital)
                
                # Create Incident
                inc_uuid = uuid.uuid4()
                incidents.append(Incident(
                    id=inc_uuid,
                    hazard_type=hazard,
                    latitude=Decimal(str(round(lat, 6))),
                    longitude=Decimal(str(round(lng, 6))),
                    address=f"{fake.street_address()}, {brgy.name}",
                    barangay=brgy,
                    incident_datetime=incident_time,
                    severity_level=severity,
                    status=status,
                    impact_level=random.choice(['minimal', 'minor', 'major', 'severe']),
                    description=f"{hazard.name}: {victim_name}, {victim_age}y/o {victim_sex}. {injury}. {action}",
                    date_reported=incident_time,
                    reported_by=None  # Leave blank for dummy data
                ))
                
                # Create Detail Records
                if hazard.name == 'Vehicular Accident':
                    details.append(VehicularAccident(
                        id=uuid.uuid4(),
                        incident_id=inc_uuid,
                        vehicles_involved=random.randint(1, 4),
                        casualties=random.randint(0, 2),
                        injuries=random.randint(1, 5),
                        vehicle_types=", ".join(random.sample(VEHICLES, random.randint(1, 2))),
                        cause=random.choice(["Reckless driving", "Wet road", "Mechanical failure", "Pedestrian crossing"])
                    ))
                elif hazard.name == 'Medical Emergency':
                    details.append(MedicalEmergency(
                        id=uuid.uuid4(),
                        incident_id=inc_uuid,
                        patient_count=random.randint(1, 3),
                        emergency_type=random.choice(["Cardiac", "Respiratory", "Trauma", "Heat-related", "Diabetic"]),
                        transported=1 if "transported" in action.lower() else 0,
                        hospital=hospital if "transported" in action.lower() else ""
                    ))
                elif hazard.name == 'Fire':
                    details.append(FireDetails(
                        id=uuid.uuid4(),
                        incident_id=inc_uuid,
                        cause=random.choice(["Electrical", "Unattended cooking", "Arson suspected", "Chemical"]),
                        casualties=0,
                        injuries=random.randint(0, 3),
                        structures_affected=random.randint(1, 3)
                    ))
                
                # Responder Report
                reports.append(ResponderReport(
                    id=uuid.uuid4(),
                    incident_id=inc_uuid,
                    responder=random.choice(responder_pool),  # Placeholder
                    report_time=incident_time + timedelta(minutes=random.randint(5, 45)),
                    report_text=f"Victim: {victim_name}, {victim_age}y/o {victim_sex}. Condition: {injury}. Address: {brgy.name}.",
                    action_taken=action,
                    status_update=status,
                    media_url=""
                ))
            
            # Bulk insert for performance
            Incident.objects.bulk_create(incidents)
            if details:
                # Group by model type for bulk_create
                from django.contrib.contenttypes.models import ContentType
                # Simplified: just create in batches
                for d in details:
                    d.save()  # Fallback since bulk_create with OneToOne is tricky
            ResponderReport.objects.bulk_create(reports)
            
        self.stdout.write(self.style.SUCCESS(f'✅ Generated {count} accomplishment report entries.'))
        
        if export:
            self.export_daily_reports(days)

    def export_daily_reports(self, days):
        """Optional: Group incidents by day and export as text accomplishment reports"""
        from datetime import date
        import os
        
        os.makedirs('accomplishment_reports', exist_ok=True)
        start_date = timezone.now() - timedelta(days=days)
        
        for day_offset in range(days):
            current_date = (start_date + timedelta(days=day_offset)).date()
            incidents = Incident.objects.filter(incident_datetime__date=current_date).order_by('incident_datetime')
            
            if not incidents.exists():
                continue
                
            team = random.choice(TEAMS)
            filename = f"accomplishment_reports/EOD_{current_date}_Team{team}.txt"
            
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(f"ACCOMPLISHMENT REPORT\n")
                f.write(f"TEAM: {team} | DATE: {current_date} | TIME: 0800H - 0800H\n")
                f.write(f"FOR: JANET V. GENDRANO\n\n")
                f.write(f"RESPONDED TO: {'✓' if incidents.filter(hazard_type__name='Vehicular Accident').exists() else '□'} RCA  ")
                f.write(f"{'✓' if incidents.filter(hazard_type__name='Fire').exists() else '□'} FIRE  ")
                f.write(f"{'✓' if incidents.filter(hazard_type__name='Medical Emergency').exists() else '□'} MEDICAL\n\n")
                
                for inc in incidents:
                    time_str = inc.incident_datetime.strftime("%H%M") + "H"
                    f.write(f"[{time_str}] {inc.hazard_type.name.upper()}\n")
                    f.write(f"  Loc: {inc.address}\n")
                    f.write(f"  Desc: {inc.description[:100]}...\n")
                    f.write(f"  Status: {inc.severity_level.upper()} | {inc.status.upper()}\n\n")
                    
            self.stdout.write(f"📄 Exported: {filename}")