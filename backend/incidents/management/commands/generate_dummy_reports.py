import random
from datetime import timedelta, time, datetime
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from django.db.models.functions import Length
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

TEAMS = [
    'Alpha',
    'Bravo',
    'Charlie',
]

# Lucena coordinate guardrail used by your frontend validation.
# Location strings are paired with exact fixed coordinates in LUCENA_POINTS,
# so generated incident reports keep their address and longitude/latitude aligned.
LUCENA_MIN_LAT = 13.89
LUCENA_MAX_LAT = 13.98
LUCENA_MIN_LNG = 121.57
LUCENA_MAX_LNG = 121.69

# IMPORTANT:
# These locations are paired with fixed coordinates.
# Do not add random offsets to coordinates because that can place markers in the wrong barangay.
# For real operations, use phone/browser GPS from the responder device.
# This dataset is for demo/testing data only.
LUCENA_POINTS = [
    {'display_name': 'Barangay 1, Lucena City', 'latitude': 13.934600, 'longitude': 121.612200},
    {'display_name': 'Barangay 2, Lucena City', 'latitude': 13.936100, 'longitude': 121.613500},
    {'display_name': 'Barangay 3, Lucena City', 'latitude': 13.937500, 'longitude': 121.614800},
    {'display_name': 'Barangay 4, Lucena City', 'latitude': 13.938900, 'longitude': 121.616200},
    {'display_name': 'Barangay 5, Lucena City', 'latitude': 13.940300, 'longitude': 121.617600},
    {'display_name': 'Barangay 6, Lucena City', 'latitude': 13.941700, 'longitude': 121.619000},
    {'display_name': 'Barangay 7, Lucena City', 'latitude': 13.943100, 'longitude': 121.620400},
    {'display_name': 'Barangay 8, Lucena City', 'latitude': 13.944500, 'longitude': 121.621800},
    {'display_name': 'Barangay 9, Lucena City', 'latitude': 13.945900, 'longitude': 121.623200},
    {'display_name': 'Barangay 10, Lucena City', 'latitude': 13.947300, 'longitude': 121.624600},
    {'display_name': 'Barangay 11, Lucena City', 'latitude': 13.948900, 'longitude': 121.626100},
    {'display_name': 'Barra, Lucena City', 'latitude': 13.915600, 'longitude': 121.608900},
    {'display_name': 'Bocohan, Lucena City', 'latitude': 13.948200, 'longitude': 121.609400},
    {'display_name': 'Cotta, Lucena City', 'latitude': 13.933000, 'longitude': 121.627900},
    {'display_name': 'Dalahican, Lucena City', 'latitude': 13.914700, 'longitude': 121.650200},
    {'display_name': 'Domoit, Lucena City', 'latitude': 13.974200, 'longitude': 121.601800},
    {'display_name': 'Gulang-Gulang, Lucena City', 'latitude': 13.949400, 'longitude': 121.598600},
    {'display_name': 'Ibabang Dupay, Lucena City', 'latitude': 13.920600, 'longitude': 121.606600},
    {'display_name': 'Ibabang Iyam, Lucena City', 'latitude': 13.936200, 'longitude': 121.608200},
    {'display_name': 'Ibabang Talim, Lucena City', 'latitude': 13.912300, 'longitude': 121.592100},
    {'display_name': 'Ilayang Dupay, Lucena City', 'latitude': 13.925900, 'longitude': 121.596700},
    {'display_name': 'Ilayang Iyam, Lucena City', 'latitude': 13.953000, 'longitude': 121.615900},
    {'display_name': 'Ilayang Talim, Lucena City', 'latitude': 13.918700, 'longitude': 121.572400},
    {'display_name': 'Isabang, Lucena City', 'latitude': 13.971800, 'longitude': 121.582100},
    {'display_name': 'Marketview, Lucena City', 'latitude': 13.933800, 'longitude': 121.616100},
    {'display_name': 'Mayao Castillo, Lucena City', 'latitude': 13.905800, 'longitude': 121.590600},
    {'display_name': 'Mayao Crossing, Lucena City', 'latitude': 13.908900, 'longitude': 121.585700},
    {'display_name': 'Mayao Kanluran, Lucena City', 'latitude': 13.898900, 'longitude': 121.578500},
    {'display_name': 'Mayao Parada, Lucena City', 'latitude': 13.913800, 'longitude': 121.594500},
    {'display_name': 'Mayao Silangan, Lucena City', 'latitude': 13.902900, 'longitude': 121.599400},
    {'display_name': 'Ransohan, Lucena City', 'latitude': 13.921500, 'longitude': 121.581600},
    {'display_name': 'Salinas, Lucena City', 'latitude': 13.926700, 'longitude': 121.651300},
    {'display_name': 'Talao-Talao, Lucena City', 'latitude': 13.925400, 'longitude': 121.641500},
]

INCIDENT_TEMPLATES = {
    'Fire Incident': {
        'descriptions': [
            'Fire incident reported at {location}. Initial report indicates visible smoke and possible electrical origin.',
            'Residential fire response requested at {location}. Nearby residents were advised to evacuate as a precaution.',
            'Smoke investigation and fire suppression assistance requested at {location}.',
        ],
        'actions': [
            'Responders established a safety perimeter, conducted fire suppression, checked for hotspots, and coordinated initial damage assessment.',
            'Fire team deployed attack lines, evacuated affected occupants, and secured the area after the fire was controlled.',
            'Scene was assessed, fire source was isolated, and responders monitored the structure for possible rekindling.',
        ],
    },
    'Medical Emergency': {
        'descriptions': [
            'Medical emergency reported at {location}. Patient complained of weakness and difficulty breathing.',
            'Emergency medical assistance requested at {location} for a patient requiring immediate assessment.',
            'Person in distress reported at {location}. EMS team dispatched for evaluation and transport.',
        ],
        'actions': [
            'EMS assessed the patient, monitored vital signs, provided first aid, and coordinated transport to a medical facility.',
            'Responders performed initial triage, provided oxygen support when needed, and documented patient condition.',
            'Patient was stabilized on scene and transferred for further medical evaluation.',
        ],
    },
    'RCA': {
        'descriptions': [
            'Road crash accident reported at {location}. Initial report involves a motorcycle and another vehicle.',
            'Vehicular accident reported at {location}. Traffic obstruction and injured persons were noted at the scene.',
            'Road collision response requested at {location}. Emergency responders were dispatched for rescue and traffic control.',
        ],
        'actions': [
            'Responders secured the roadway, assessed victims, provided first aid, and coordinated traffic clearing operations.',
            'Victims were assisted, scene hazards were controlled, and vehicles were moved after documentation.',
            'Initial triage was conducted and injured persons were transported for further evaluation.',
        ],
    },
    'Crime Against Person/Property': {
        'descriptions': [
            'Crime against person/property reported at {location}. Witnesses reported a disturbance and possible theft.',
            'Security-related incident reported at {location}. Responders requested police coordination and victim assistance.',
            'Property-related complaint reported at {location}. Scene verification and witness interview were required.',
        ],
        'actions': [
            'Responders secured the area, assisted the victim, gathered initial statements, and coordinated with police personnel.',
            'Scene was documented, witnesses were interviewed, and the case was endorsed for investigation.',
            'Victim assistance was provided while responding personnel coordinated further action with law enforcement.',
        ],
    },
    'Drowning': {
        'descriptions': [
            'Water-related emergency reported at {location}. Victim was seen struggling near the water area.',
            'Possible drowning incident reported at {location}. Rescue personnel were dispatched immediately.',
            'Water rescue assistance requested at {location}. Bystanders reported a victim needing urgent help.',
        ],
        'actions': [
            'Water rescue team conducted search and retrieval, provided first aid, and coordinated emergency transport.',
            'Responders secured the area, assessed the victim, initiated lifesaving measures, and prepared transport.',
            'Victim was assisted by rescue personnel and endorsed for medical evaluation.',
        ],
    },
    'Ambulance Assistance': {
        'descriptions': [
            'Ambulance assistance requested at {location}. Patient required transport for further medical care.',
            'Patient transport assistance reported at {location}. EMS unit dispatched to assist the patient.',
            'Medical transport request received from {location}. Patient condition required monitoring during transfer.',
        ],
        'actions': [
            'Ambulance team assessed the patient, assisted loading, monitored vital signs, and transported to the receiving facility.',
            'EMS prepared the patient for safe transport and coordinated with hospital receiving personnel.',
            'Patient was safely transferred with continuous monitoring and proper endorsement.',
        ],
    },
    'Stand-by Medical Team': {
        'descriptions': [
            'Stand-by medical team deployed at {location} for public safety coverage.',
            'Medical standby requested at {location} for a community activity and crowd monitoring.',
            'Preventive medical deployment conducted at {location}.',
        ],
        'actions': [
            'Medical team maintained standby coverage, monitored the area, and provided minor first aid as needed.',
            'Responders remained on site for emergency readiness and documented all minor consultations.',
            'Standby team completed monitoring with no major incident requiring hospital transport.',
        ],
    },
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
    'Smoke inhalation',
    'Minor burn injury',
    'Anxiety and shock after incident',
]

VICTIM_ADDRESS_SUFFIXES = [
    'Lucena City',
    'Barangay Gulang-Gulang, Lucena City',
    'Barangay Ibabang Dupay, Lucena City',
    'Barangay Market View, Lucena City',
    'Barangay Bocohan, Lucena City',
    'Barangay Dalahican, Lucena City',
    'Barangay Isabang, Lucena City',
]


def is_within_lucena(latitude, longitude):
    return (
        LUCENA_MIN_LAT <= float(latitude) <= LUCENA_MAX_LAT
        and LUCENA_MIN_LNG <= float(longitude) <= LUCENA_MAX_LNG
    )


def validate_lucena_points():
    invalid_points = []

    for point in LUCENA_POINTS:
        lat = point['latitude']
        lng = point['longitude']

        if not is_within_lucena(lat, lng):
            invalid_points.append(f"{point['display_name']} | {lat}, {lng}")

    if invalid_points:
        raise ValueError(
            'Some demo coordinates are outside the Lucena validation range:\n'
            + '\n'.join(invalid_points)
        )


def build_point_sequence(count):
    """
    Returns locations in random order.
    If count <= number of points, locations will not repeat.
    If count > number of points, it repeats only after all locations have been used once.
    """
    validate_lucena_points()

    points = LUCENA_POINTS[:]
    random.shuffle(points)

    if count <= len(points):
        return points[:count]

    sequence = []

    while len(sequence) < count:
        batch = LUCENA_POINTS[:]
        random.shuffle(batch)
        sequence.extend(batch)

    return sequence[:count]


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


def get_next_number_from_codes(model, field_name, prefix):
    last = model.objects.filter(
        **{f'{field_name}__startswith': prefix}
    ).order_by(
        Length(field_name),
        field_name,
    ).last()

    if not last:
        return 1

    try:
        return int(getattr(last, field_name).split('-')[-1]) + 1
    except (ValueError, IndexError, AttributeError):
        return 1


def generate_incident_code(year, offset):
    prefix = f'INC-{year}-'

    report_next = get_next_number_from_codes(IncidentReport, 'incident_code', prefix)
    incident_next = get_next_number_from_codes(Incident, 'reference_code', prefix)

    next_number = max(report_next, incident_next) + offset
    return f'{prefix}{next_number:05d}'


def get_random_demo_record(point):
    incident_type = random.choice(list(INCIDENT_TEMPLATES.keys()))
    template = INCIDENT_TEMPLATES[incident_type]
    location = point['display_name']

    if incident_type == 'Stand-by Medical Team':
        victim_count = random.choice([0, 0, 1])
    elif incident_type == 'Fire Incident':
        victim_count = random.randint(0, 4)
    elif incident_type == 'RCA':
        victim_count = random.randint(1, 5)
    elif incident_type == 'Drowning':
        victim_count = random.randint(1, 3)
    else:
        victim_count = random.randint(1, 4)

    return {
        'incident_type': incident_type,
        'location': location,
        'latitude': round(float(point['latitude']), 6),
        'longitude': round(float(point['longitude']), 6),
        'description': random.choice(template['descriptions']).format(location=location),
        'action_taken': random.choice(template['actions']),
        'victim_count': victim_count,
        # New responder-side reports must start unapproved so they appear only in the admin review list.
        # They should not plot on the map until the admin clicks Approve.
        'status': random.choice(['Submitted', 'Pending']),
    }


def create_incident_details(incident, incident_type, victim_count):
    lower = incident_type.lower()

    if 'fire' in lower:
        FireDetails.objects.get_or_create(
            incident=incident,
            defaults={
                'cause': random.choice([
                    'Electrical short circuit',
                    'Unattended cooking',
                    'Overheated appliance',
                    'Under investigation',
                ]),
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
                'cause': random.choice([
                    'Driver error',
                    'Wet road condition',
                    'Overspeeding',
                    'Under investigation',
                ]),
                'vehicle_types': random.choice([
                    'Motorcycle / Tricycle',
                    'Motorcycle / Private Vehicle',
                    'Jeepney / Motorcycle',
                    'Private Vehicle / Truck',
                ]),
            },
        )
        return

    if 'crime' in lower:
        CrimeReport.objects.get_or_create(
            incident=incident,
            defaults={
                'crime_type': incident_type,
                'suspects': random.randint(1, 3),
                'victims': victim_count,
                'arrested': random.choice([False, False, True]),
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
                'transported': victim_count if victim_count > 0 else 0,
                'hospital': random.choice([
                    'Quezon Medical Center',
                    'Mt. Carmel Diocesan General Hospital',
                    'Lucena United Doctors Hospital',
                    '',
                ]),
            },
        )
        return

    if 'drowning' in lower:
        DrowningIncident.objects.get_or_create(
            incident=incident,
            defaults={
                'victims': max(victim_count, 1),
                'rescued': max(victim_count - random.randint(0, 1), 0),
                'fatalities': 0,
                'water_body': 'Coastal or waterway area in Lucena City',
            },
        )


class Command(BaseCommand):
    help = 'Generate demo incident data with many non-repeating Lucena locations and paired coordinates.'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=10)
        parser.add_argument('--days', type=int, default=7)
        parser.add_argument('--compile', type=int, default=2)
        parser.add_argument('--clear', action='store_true')
        parser.add_argument(
            '--all-approved',
            action='store_true',
            help='Testing only: force generated reports to Approved so markers immediately plot on the map. Do not use this for approval-flow demos.',
        )
        parser.add_argument(
            '--audit-only',
            action='store_true',
            help='Print the coordinate list and do not create database records.',
        )

    def print_coordinate_audit(self):
        self.stdout.write(self.style.SUCCESS('Lucena demo coordinate audit:'))

        for index, point in enumerate(LUCENA_POINTS, start=1):
            lat = round(float(point['latitude']), 6)
            lng = round(float(point['longitude']), 6)
            status = 'OK' if is_within_lucena(lat, lng) else 'OUTSIDE_LUCENA'

            self.stdout.write(
                f"{index:02d}. {point['display_name']} | {lat}, {lng} | {status}"
            )

    def handle(self, *args, **options):
        count = max(int(options['count']), 1)
        days = max(int(options['days']), 1)
        compile_count = max(int(options['compile']), 0)
        should_clear = options['clear']
        all_approved = options['all_approved']
        audit_only = options['audit_only']

        validate_lucena_points()
        self.print_coordinate_audit()

        if audit_only:
            return

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
            self.stdout.write(self.style.WARNING('Clearing old incident-related data...'))
            AccomplishmentReport.objects.all().delete()
            VictimDetail.objects.all().delete()
            IncidentReport.objects.all().delete()
            FireDetails.objects.all().delete()
            VehicularAccident.objects.all().delete()
            CrimeReport.objects.all().delete()
            MedicalEmergency.objects.all().delete()
            DrowningIncident.objects.all().delete()
            Incident.objects.all().delete()

        self.stdout.write(f'Generating {count} demo incident reports with non-repeating Lucena locations...')

        created_reports = []
        now = timezone.now()
        start_date = now - timedelta(days=days)
        selected_points = build_point_sequence(count)

        with transaction.atomic():
            for index in range(count):
                point = selected_points[index]
                demo = get_random_demo_record(point)

                created_at = start_date + timedelta(
                    days=index % days,
                    hours=(index * 3) % 24,
                    minutes=(index * 7) % 60,
                )

                incident_type = demo['incident_type']
                victim_count = demo['victim_count']
                location = demo['location']
                latitude = demo['latitude']
                longitude = demo['longitude']
                demo['status'] = 'Pending'
                status = demo['status']
                incident_code = generate_incident_code(created_at.year, index)
                occurred_time = time(
                    hour=(8 + index * 2) % 24,
                    minute=(index * 11) % 60,
                )

                if not is_within_lucena(latitude, longitude):
                    raise ValueError(
                        f'Invalid Lucena coordinates for {location}: {latitude}, {longitude}'
                    )

                report = IncidentReport.objects.create(
                    incident_code=incident_code,
                    time_occurred=occurred_time,
                    incident_type=incident_type,
                    responder_team=TEAMS[index % len(TEAMS)],
                    location=location,
                    latitude=Decimal(str(latitude)),
                    longitude=Decimal(str(longitude)),
                    description=demo['description'],
                    victim_count=victim_count,
                    action_taken=demo['action_taken'],
                    status=status,
                    created_by=responders[index % len(responders)],
                )

                # Optional demo backdating. This keeps the record realistic for analytics.
                IncidentReport.objects.filter(id=report.id).update(created_at=created_at)
                report.created_at = created_at

                # Approval-flow rule:
                # A newly submitted responder report should be visible only in the admin side review list.
                # Do not create a plottable admin Incident until the report is Approved.
                if status == 'Approved':
                    hazard_name = get_hazard_name(incident_type)
                    hazard_type, _ = HazardType.objects.get_or_create(
                        name=hazard_name,
                        defaults={'description': f'{hazard_name} generated for demo data'},
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
                        status='verified',
                        impact_level=get_impact(victim_count),
                        description=demo['description'],
                    )

                    create_incident_details(incident, incident_type, victim_count)

                for victim_index in range(victim_count):
                    VictimDetail.objects.create(
                        incident_report=report,
                        name=fake.name(),
                        age=str(random.randint(1, 80)),
                        gender=random.choice(['M', 'F']),
                        address=random.choice(VICTIM_ADDRESS_SUFFIXES),
                        condition=CONDITIONS[(index + victim_index) % len(CONDITIONS)],
                    )

                created_reports.append(report)

            if created_reports and compile_count > 0:
                for batch_index in range(min(compile_count, len(created_reports))):
                    selected_reports = created_reports[
                        batch_index::max(compile_count, 1)
                    ] or [created_reports[batch_index]]

                    accomplishment = AccomplishmentReport.objects.create(
                        title=f'Demo Accomplishment Report {batch_index + 1}',
                        total_reports=len(selected_reports),
                        status='Compiled',
                        compiled_by=responders[batch_index % len(responders)],
                    )
                    accomplishment.incident_reports.set(selected_reports)

        approved_count = IncidentReport.objects.filter(status='Approved').count()

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully generated {count} demo incident reports, '
                f'{Incident.objects.count()} admin incidents, '
                f'{VictimDetail.objects.count()} victim details, '
                f'{AccomplishmentReport.objects.count()} accomplishment reports. '
                f'Approved reports: {approved_count}.'
            )
        )
