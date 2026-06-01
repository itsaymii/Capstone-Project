import random
from datetime import timedelta, time, datetime
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from faker import Faker

from incidents.models import (
    HazardType,
    Incident,
    IncidentReport,
    VictimDetail,
    AccomplishmentReport,
    FireDetails,
    VehicularAccident,
    CrimeReport,
    MedicalEmergency,
    DrowningIncident,
)

fake = Faker('fil_PH')

INCIDENT_TYPES = [
    'RCA',
    'Fire Incident',
    'Crime Against Person/Property',
    'Medical Emergency',
    'Ambulance Assistance',
    'Stand-by Medical Team',
    'Drowning',
]

TEAMS = [
    'Alpha Responder Squad',
    'Bravo Rescue Team',
    'Charlie Medical Unit',
    'Delta Emergency Response',
]

LOCATIONS = [
    'Barangay 1, Lucena City',
    'Barangay 2, Lucena City',
    'Barangay 3, Lucena City',
    'Barangay 4, Lucena City',
    'Barangay 5, Lucena City',
    'Barangay 6, Lucena City',
    'Barangay 7, Lucena City',
    'Barangay 8, Lucena City',
    'Barangay 9, Lucena City',
    'Barangay 10, Lucena City',
    'Barangay 11, Lucena City',
    'Dalahican Road, Lucena City',
    'Diversion Road, Lucena City',
    'Quezon Avenue, Lucena City',
    'Tayabas Road, Lucena City',
    'Ibabang Dupay, Lucena City',
    'Gulang-Gulang, Lucena City',
    'Ilayang Iyam, Lucena City',
    'Ibabang Iyam, Lucena City',
    'Mayao Crossing, Lucena City',
    'Mayao Kanluran, Lucena City',
    'Mayao Silangan, Lucena City',
    'Cotta, Lucena City',
    'Bocohan, Lucena City',
    'Isabang, Lucena City',
    'Market View, Lucena City',
    'Domoit, Lucena City',
]

LOCATION_COORDINATES = {
    'Barangay 1, Lucena City': (13.9346, 121.6122),
    'Barangay 2, Lucena City': (13.9361, 121.6135),
    'Barangay 3, Lucena City': (13.9375, 121.6148),
    'Barangay 4, Lucena City': (13.9389, 121.6162),
    'Barangay 5, Lucena City': (13.9403, 121.6176),
    'Barangay 6, Lucena City': (13.9417, 121.6190),
    'Barangay 7, Lucena City': (13.9431, 121.6204),
    'Barangay 8, Lucena City': (13.9445, 121.6218),
    'Barangay 9, Lucena City': (13.9459, 121.6232),
    'Barangay 10, Lucena City': (13.9473, 121.6246),
    'Barangay 11, Lucena City': (13.9480, 121.6255),
    'Dalahican Road, Lucena City': (13.9147, 121.6502),
    'Diversion Road, Lucena City': (13.9180, 121.6260),
    'Quezon Avenue, Lucena City': (13.9390, 121.6170),
    'Tayabas Road, Lucena City': (13.9303, 121.6352),
    'Ibabang Dupay, Lucena City': (13.9206, 121.6066),
    'Gulang-Gulang, Lucena City': (13.9494, 121.5986),
    'Ilayang Iyam, Lucena City': (13.9530, 121.6159),
    'Ibabang Iyam, Lucena City': (13.9362, 121.6082),
    'Mayao Crossing, Lucena City': (13.9089, 121.5857),
    'Mayao Kanluran, Lucena City': (13.9001, 121.5741),
    'Mayao Silangan, Lucena City': (13.9029, 121.5994),
    'Cotta, Lucena City': (13.9330, 121.6279),
    'Bocohan, Lucena City': (13.9482, 121.6094),
    'Isabang, Lucena City': (13.9718, 121.5821),
    'Market View, Lucena City': (13.9338, 121.6161),
    'Domoit, Lucena City': (13.9742, 121.6018),
}

CONDITIONS = [
    'Conscious and oriented',
    'Minor abrasion',
    'Laceration on arm',
    'Complaining of chest pain',
    'Difficulty breathing',
    'Suspected fracture',
    'Dizziness',
    'Weakness',
    'Transported to hospital',
]

ACTIONS = [
    'Provided first aid and monitored vital signs.',
    'Cleaned wound and applied sterile dressing.',
    'Assisted patient and coordinated transport.',
    'Conducted scene assessment and secured the area.',
    'Provided oxygen support and continuous monitoring.',
    'Transferred patient to receiving medical facility.',
    'Performed initial triage and documented patient condition.',
]


def get_randomized_coordinates(location):
    base_lat, base_lng = LOCATION_COORDINATES.get(location, (13.9414, 121.6236))

    latitude = round(base_lat + random.uniform(-0.0018, 0.0018), 6)
    longitude = round(base_lng + random.uniform(-0.0018, 0.0018), 6)

    latitude = min(max(latitude, 13.89), 13.98)
    longitude = min(max(longitude, 121.57), 121.69)

    return latitude, longitude


def get_hazard_name(incident_type):
    lower = incident_type.lower()

    if 'fire' in lower:
        return 'Fire'
    if 'rca' in lower or 'vehicular' in lower or 'accident' in lower:
        return 'Vehicular Accident'
    if 'crime' in lower:
        return 'Crime'
    if 'medical' in lower or 'ambulance' in lower or 'stand-by' in lower:
        return 'Medical Emergency'
    if 'drowning' in lower:
        return 'Drowning'

    return 'Medical Emergency'


def get_severity(incident_type, victim_count):
    lower = incident_type.lower()

    if victim_count >= 4:
        return 'critical'
    if victim_count >= 2:
        return 'high'
    if 'fire' in lower or 'crime' in lower or 'drowning' in lower:
        return 'moderate'
    if victim_count > 0:
        return 'moderate'

    return 'low'


def get_impact(victim_count):
    if victim_count >= 4:
        return 'major'
    if victim_count >= 2:
        return 'minor'
    return 'minimal'


def create_incident_details(incident, incident_type, victim_count):
    lower = incident_type.lower()

    if 'fire' in lower:
        FireDetails.objects.get_or_create(
            incident=incident,
            defaults={
                'cause': 'Generated demo data',
                'damage_estimate': None,
                'casualties': 0,
                'injuries': victim_count,
                'structures_affected': random.randint(1, 3),
            },
        )
        return

    if 'rca' in lower or 'vehicular' in lower or 'accident' in lower:
        VehicularAccident.objects.get_or_create(
            incident=incident,
            defaults={
                'vehicles_involved': random.randint(1, 4),
                'casualties': 0,
                'injuries': victim_count,
                'cause': 'Generated demo data',
                'vehicle_types': random.choice(['Motorcycle', 'Car', 'Tricycle', 'Van']),
            },
        )
        return

    if 'crime' in lower:
        CrimeReport.objects.get_or_create(
            incident=incident,
            defaults={
                'crime_type': incident_type,
                'suspects': random.randint(0, 3),
                'victims': victim_count,
                'arrested': random.choice([True, False]),
                'case_status': 'under_investigation',
            },
        )
        return

    if 'medical' in lower or 'ambulance' in lower or 'stand-by' in lower:
        MedicalEmergency.objects.get_or_create(
            incident=incident,
            defaults={
                'patient_count': max(victim_count, 1),
                'emergency_type': incident_type,
                'transported': random.randint(0, max(victim_count, 1)),
                'hospital': random.choice(['Lucena United Doctors Hospital', 'Quezon Medical Center', '']),
            },
        )
        return

    if 'drowning' in lower:
        DrowningIncident.objects.get_or_create(
            incident=incident,
            defaults={
                'victims': max(victim_count, 1),
                'rescued': random.randint(0, max(victim_count, 1)),
                'fatalities': 0,
                'water_body': 'Generated demo location',
            },
        )


class Command(BaseCommand):
    help = 'Generate complete demo data: IncidentReport, VictimDetail, AccomplishmentReport, Incident, related hazard details, latitude, and longitude.'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=50)
        parser.add_argument('--days', type=int, default=60)
        parser.add_argument('--compile', type=int, default=10)
        parser.add_argument('--clear', action='store_true')

    def handle(self, *args, **options):
        count = options['count']
        days = options['days']
        compile_count = options['compile']
        should_clear = options['clear']

        User = get_user_model()

        responders = list(User.objects.filter(is_staff=True))
        if not responders:
            responder = User.objects.create_user(
                username='field_responder',
                email='responder@example.com',
                password='Demo1234!',
                is_staff=True,
            )
            responders = [responder]

        if should_clear:
            self.stdout.write(self.style.WARNING('Clearing old generated data...'))
            AccomplishmentReport.objects.all().delete()
            VictimDetail.objects.all().delete()
            IncidentReport.objects.all().delete()

            FireDetails.objects.all().delete()
            VehicularAccident.objects.all().delete()
            CrimeReport.objects.all().delete()
            MedicalEmergency.objects.all().delete()
            DrowningIncident.objects.all().delete()
            Incident.objects.all().delete()

        self.stdout.write(f'Generating {count} complete incident report records...')

        created_reports = []
        now = timezone.now()
        start_date = now - timedelta(days=days)

        with transaction.atomic():
            for index in range(count):
                created_at = start_date + timedelta(
                    days=random.randint(0, days),
                    hours=random.randint(0, 23),
                    minutes=random.randint(0, 59),
                )

                incident_type = random.choice(INCIDENT_TYPES)
                victim_count = random.randint(0, 4)
                location = random.choice(LOCATIONS)
                latitude, longitude = get_randomized_coordinates(location)
                incident_code = f'INC-{created_at.year}-{index + 1:03d}'
                occurred_time = time(
                    hour=random.randint(0, 23),
                    minute=random.randint(0, 59),
                )

                report = IncidentReport.objects.create(
                    incident_code=incident_code,
                    time_occurred=occurred_time,
                    incident_type=incident_type,
                    responder_team=random.choice(TEAMS),
                    location=location,
                    latitude=latitude,
                    longitude=longitude,
                    description=f'{incident_type} reported at {location}. {fake.sentence()}',
                    victim_count=victim_count,
                    action_taken=random.choice(ACTIONS),
                    status=random.choice(['Submitted', 'Pending', 'Approved']),
                    created_by=random.choice(responders),
                )

                IncidentReport.objects.filter(id=report.id).update(created_at=created_at)
                report.created_at = created_at

                hazard_name = get_hazard_name(incident_type)
                hazard_type, _ = HazardType.objects.get_or_create(
                    name=hazard_name,
                    defaults={'description': f'{hazard_name} generated from demo data'},
                )

                incident_datetime = timezone.make_aware(
                    datetime.combine(created_at.date(), occurred_time)
                )

                incident = Incident.objects.create(
                    reference_code=incident_code,
                    hazard_type=hazard_type,
                    latitude=Decimal(str(latitude)),
                    longitude=Decimal(str(longitude)),
                    address=location,
                    reported_by=report.created_by,
                    incident_datetime=incident_datetime,
                    severity_level=get_severity(incident_type, victim_count),
                    status='verified' if report.status == 'Approved' else 'reported',
                    impact_level=get_impact(victim_count),
                    description=report.description,
                )

                create_incident_details(incident, incident_type, victim_count)

                for _ in range(victim_count):
                    VictimDetail.objects.create(
                        incident_report=report,
                        name=fake.name(),
                        age=str(random.randint(1, 85)),
                        gender=random.choice(['M', 'F']),
                        address=random.choice(LOCATIONS),
                        condition=random.choice(CONDITIONS),
                    )

                created_reports.append(report)

            if created_reports:
                for _ in range(min(compile_count, max(1, count // 3))):
                    batch_size = random.randint(1, min(5, len(created_reports)))
                    selected_reports = random.sample(created_reports, batch_size)

                    accomplishment = AccomplishmentReport.objects.create(
                        title='Accomplishment Report',
                        total_reports=len(selected_reports),
                        status='Compiled',
                        compiled_by=random.choice(responders),
                    )
                    accomplishment.incident_reports.set(selected_reports)

        approved_count = IncidentReport.objects.filter(status='Approved').count()

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully generated {count} incident reports, '
                f'{Incident.objects.count()} admin incidents, '
                f'{VictimDetail.objects.count()} victim details, '
                f'{AccomplishmentReport.objects.count()} accomplishment reports. '
                f'Approved reports: {approved_count}.'
            )
        )
