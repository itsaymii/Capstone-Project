import random
from datetime import datetime, time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models.functions import Length
from django.utils import timezone
from faker import Faker

from incidents.models import (
    AccomplishmentReport,
    IncidentReport,
    VictimDetail,
)

try:
    from incidents.models import Incident, HazardType
except Exception:  # Keeps command safe if these models are not available in this branch.
    Incident = None
    HazardType = None

try:
    from locations.models import Barangay
except Exception:
    Barangay = None

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

TEAMS = ['Alpha', 'Bravo', 'Charlie']

# Official 33 barangays of Lucena City. These names match the frontend dropdown.
BARANGAY_NAMES = [
    'Barangay 1',
    'Barangay 2',
    'Barangay 3',
    'Barangay 4',
    'Barangay 5',
    'Barangay 6',
    'Barangay 7',
    'Barangay 8',
    'Barangay 9',
    'Barangay 10',
    'Barangay 11',
    'Barra',
    'Bocohan',
    'Cotta',
    'Dalahican',
    'Domoit',
    'Gulang-Gulang',
    'Ibabang Dupay',
    'Ibabang Iyam',
    'Ibabang Talim',
    'Ilayang Dupay',
    'Ilayang Iyam',
    'Ilayang Talim',
    'Isabang',
    'Market View',
    'Mayao Castillo',
    'Mayao Crossing',
    'Mayao Kanluran',
    'Mayao Parada',
    'Mayao Silangan',
    'Ransohan',
    'Salinas',
    'Talao-Talao',
]

BARANGAY_COORDINATES = {
    'Barangay 1': (13.9389702, 121.6124776),
    'Barangay 2': (13.939363479614258, 121.6145248413086),
    'Barangay 3': (13.9374033, 121.6122379),
    'Barangay 4': (13.9368604, 121.6128604),
    'Barangay 5': (13.935468, 121.6116846),
    'Barangay 6': (13.9342259, 121.6139289),
    'Barangay 7': (13.9332718, 121.6118396),
    'Barangay 8': (13.9268764, 121.6135034),
    'Barangay 9': (13.931232452392578, 121.6135482788086),
    'Barangay 10': (13.9268764, 121.6135034),
    'Barangay 11': (13.9416713, 121.61457),
    'Barra': (13.899703613473259, 121.60599681715252),
    'Bocohan': (13.958983421325684, 121.59123992919922),
    'Cotta': (13.916782260591965, 121.606392873038),
    'Dalahican': (13.906243324279785, 121.61962890625),
    'Domoit': (13.9656741, 121.5954539),
    'Gulang-Gulang': (13.964309692382812, 121.6095962524414),
    'Ibabang Dupay': (13.9413972, 121.6235766),
    'Ibabang Iyam': (13.9262972, 121.6012926),
    'Ibabang Talim': (13.933329582214355, 121.61666870117188),
    'Ilayang Dupay': (13.975142616912596, 121.62297889588788),
    'Ilayang Iyam': (13.9421715, 121.6046099),
    'Ilayang Talim': (13.933329582214355, 121.61666870117188),
    'Isabang': (13.9485716, 121.5838776),
    'Market View': (13.933917045593262, 121.61720275878906),
    'Mayao Castillo': (13.931166648864746, 121.66316986083984),
    'Mayao Crossing': (13.9257621, 121.6217745),
    'Mayao Kanluran': (13.9493974, 121.634851),
    'Mayao Parada': (13.927044090129849, 121.6437013480862),
    'Mayao Silangan': (13.9544415, 121.6468125),
    'Ransohan': (13.893268843518467, 121.5923653381981),
    'Salinas': (13.904104586584326, 121.57631428841128),
    'Talao-Talao': (13.908086776733398, 121.62608337402344),
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

INCIDENT_DESCRIPTIONS = {
    'RCA': [
        'Road crash incident reported in the area. Responders were dispatched to assess the scene and assist involved individuals.',
        'Vehicular accident reported along the roadway. Initial response focused on traffic control, safety assessment, and victim assistance.',
        'Road collision incident recorded at the location. Field responders conducted scene assessment and provided necessary assistance.',
    ],
    'Fire Incident': [
        'Fire incident reported in the area. Responders proceeded to the scene for verification, fire suppression support, and safety monitoring.',
        'Possible structure or property fire reported by residents. Response team coordinated scene security and emergency assistance.',
        'Fire emergency recorded at the location. Responders conducted initial assessment and coordinated appropriate emergency actions.',
    ],
    'Crime Against Person/Property': [
        'Crime-related incident reported in the area. Responders documented the situation and coordinated with proper authorities.',
        'Complaint involving person or property was reported. Response team assisted with scene assessment and initial documentation.',
        'Reported crime incident recorded at the location. Responders secured the area and assisted the affected individuals.',
    ],
    'Medical Emergency': [
        'Medical emergency reported in the area. Responders provided initial assessment, first aid, and patient monitoring.',
        'Patient required urgent medical assistance. Response team assessed the condition and prepared for possible transport.',
        'Health-related emergency recorded at the location. Responders provided immediate care and coordinated medical support.',
    ],
    'Ambulance Assistance': [
        'Ambulance assistance requested for patient transport and medical support.',
        'Emergency medical transport assistance was provided to the patient at the reported location.',
        'Ambulance response conducted for patient assessment, monitoring, and possible transfer to a medical facility.',
    ],
    'Stand-by Medical Team': [
        'Medical team deployed for standby support during an activity or field operation.',
        'Standby medical assistance provided to ensure immediate response readiness in the area.',
        'Medical personnel assigned on standby status for emergency preparedness and public safety support.',
    ],
    'Drowning': [
        'Drowning incident reported near the area. Responders conducted rescue assessment and provided emergency assistance.',
        'Water-related emergency recorded at the location. Response team assisted with rescue operations and victim care.',
        'Possible drowning case reported. Responders proceeded to the scene for immediate assessment and emergency support.',
    ],
}


def has_model_field(model, field_name):
    if model is None:
        return False
    return any(field.name == field_name for field in model._meta.get_fields())


def get_model_field_names(model):
    if model is None:
        return set()
    return {field.name for field in model._meta.get_fields()}


def get_first_existing_field(model, candidate_fields):
    for field_name in candidate_fields:
        if has_model_field(model, field_name):
            return field_name
    return None


def build_create_kwargs(model, **kwargs):
    allowed_fields = get_model_field_names(model)
    return {key: value for key, value in kwargs.items() if key in allowed_fields}


def normalize_barangay_name(value):
    return (
        str(value or '')
        .replace(', Lucena City', '')
        .replace('Brgy.', 'Barangay')
        .replace('Brgy ', 'Barangay ')
        .strip()
        .lower()
    )


def barangay_candidates(barangay_name):
    name = str(barangay_name or '').replace(', Lucena City', '').strip()
    if not name:
        return []

    candidates = [name]
    if name.lower().startswith('barangay '):
        number = name.split(' ', 1)[1].strip()
        candidates.extend([f'Brgy. {number}', f'Brgy {number}', number])
    else:
        candidates.extend([f'Barangay {name}', f'Brgy. {name}', f'Brgy {name}'])

    unique = []
    seen = set()
    for candidate in candidates:
        key = normalize_barangay_name(candidate)
        if key not in seen:
            seen.add(key)
            unique.append(candidate)
    return unique


def find_barangay(barangay_name):
    if Barangay is None:
        return None

    name_field = get_first_existing_field(Barangay, ['name', 'barangay_name', 'brgy_name', 'title'])
    if not name_field:
        return None

    candidates = barangay_candidates(barangay_name)

    for candidate in candidates:
        barangay = Barangay.objects.filter(**{f'{name_field}__iexact': candidate}).first()
        if barangay:
            return barangay

    normalized_target = normalize_barangay_name(barangay_name)
    for barangay in Barangay.objects.all():
        current_name = normalize_barangay_name(getattr(barangay, name_field, ''))
        if current_name == normalized_target:
            return barangay

    for candidate in candidates:
        barangay = Barangay.objects.filter(**{f'{name_field}__icontains': candidate}).first()
        if barangay:
            return barangay

    return None


def get_randomized_coordinates(barangay_name):
    base_lat, base_lng = BARANGAY_COORDINATES.get(barangay_name, (13.9414, 121.6236))

    latitude = round(base_lat + random.uniform(-0.0018, 0.0018), 6)
    longitude = round(base_lng + random.uniform(-0.0018, 0.0018), 6)

    latitude = min(max(latitude, 13.89), 13.98)
    longitude = min(max(longitude, 121.57), 121.69)

    return latitude, longitude


def get_random_created_at(start_year, end_year):
    random_year = random.randint(start_year, end_year)
    random_date = datetime(
        year=random_year,
        month=random.randint(1, 12),
        day=random.randint(1, 28),
        hour=random.randint(0, 23),
        minute=random.randint(0, 59),
        second=random.randint(0, 59),
    )
    return timezone.make_aware(random_date)


def get_incident_description(incident_type, location):
    descriptions = INCIDENT_DESCRIPTIONS.get(
        incident_type,
        ['Incident reported in the area. Responders conducted assessment and provided necessary emergency assistance.'],
    )
    return f'{random.choice(descriptions)} Location: {location}.'


def get_hazard_name_for_incident_type(incident_type):
    normalized = incident_type.lower()
    if 'fire' in normalized:
        return 'Fire'
    if 'rca' in normalized or 'road' in normalized or 'accident' in normalized:
        return 'Accident'
    if 'medical' in normalized or 'ambulance' in normalized or 'stand-by' in normalized:
        return 'Medical Emergency'
    if 'crime' in normalized:
        return 'Crime'
    if 'drowning' in normalized:
        return 'Drowning'
    return 'Incident'


def get_or_create_hazard_type(incident_type):
    if HazardType is None:
        return None
    hazard_name = get_hazard_name_for_incident_type(incident_type)
    hazard, _ = HazardType.objects.get_or_create(
        name=hazard_name,
        defaults={'description': f'Auto-generated hazard type for {hazard_name}.'},
    )
    return hazard


def set_created_at(model, object_id, created_at):
    if model is not None and has_model_field(model, 'created_at'):
        model.objects.filter(id=object_id).update(created_at=created_at)


class Command(BaseCommand):
    help = 'Generate pending incident reports with Barangay FK connected to the selected barangay dropdown values.'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=50)
        parser.add_argument('--clear', action='store_true')
        parser.add_argument('--start-year', type=int, default=2020)
        parser.add_argument('--end-year', type=int, default=2026)
        parser.add_argument(
            '--also-create-incidents',
            action='store_true',
            help='Also create Incident records connected to Barangay for map/analytics if your dashboard uses Incident.',
        )

    def handle(self, *args, **options):
        count = options['count']
        should_clear = options['clear']
        start_year = options['start_year']
        end_year = options['end_year']
        also_create_incidents = options['also_create_incidents']

        if count < 0:
            raise CommandError('count must be 0 or higher.')

        if start_year > end_year:
            raise CommandError('Invalid year range. start-year must be less than or equal to end-year.')

        if start_year < 1 or end_year > 9999:
            raise CommandError('Invalid year range. Years must be between 1 and 9999. Example: --start-year 2020 --end-year 2026')

        if Barangay is None:
            raise CommandError('locations.models.Barangay could not be imported. Cannot connect reports to barangays.')

        report_has_barangay = has_model_field(IncidentReport, 'barangay')
        if not report_has_barangay:
            raise CommandError(
                'IncidentReport has no barangay ForeignKey. Add barangay = models.ForeignKey("locations.Barangay", ...) '
                'to IncidentReport, then run makemigrations and migrate.'
            )

        if also_create_incidents and Incident is None:
            self.stdout.write(self.style.WARNING('Incident model could not be imported. Skipping --also-create-incidents.'))
            also_create_incidents = False

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
            self.stdout.write(self.style.WARNING('Clearing old generated report data...'))
            AccomplishmentReport.objects.all().delete()
            VictimDetail.objects.all().delete()
            IncidentReport.objects.all().delete()
            if also_create_incidents and Incident is not None:
                Incident.objects.all().delete()

        self.stdout.write(self.style.SUCCESS('IncidentReport barangay FK detected.'))
        if also_create_incidents:
            self.stdout.write(self.style.SUCCESS('Incident generation enabled. Incident records will also be connected to Barangay.'))

        self.stdout.write(
            self.style.WARNING(
                f'Generating {count} pending incident report records from {start_year} to {end_year}...'
            )
        )

        linked_reports = 0
        linked_incidents = 0
        not_matched = []

        with transaction.atomic():
            for index in range(count):
                created_at = get_random_created_at(start_year, end_year)
                incident_type = random.choice(INCIDENT_TYPES)
                victim_count = random.randint(0, 4)
                barangay_name = random.choice(BARANGAY_NAMES)
                barangay = find_barangay(barangay_name)

                if barangay is None:
                    not_matched.append(barangay_name)
                    raise CommandError(
                        f'Barangay "{barangay_name}" was not found in the Barangay table. '
                        'Seed/import all 33 Lucena barangays first, then run this command again.'
                    )

                location = f'{barangay_name}, Lucena City'
                latitude, longitude = get_randomized_coordinates(barangay_name)
                incident_code = f'INC-{created_at.year}-{index + 1:05d}'
                occurred_time = time(hour=random.randint(0, 23), minute=random.randint(0, 59))
                responder = random.choice(responders)
                description = get_incident_description(incident_type, location)
                action_taken = random.choice(ACTIONS)

                report_kwargs = build_create_kwargs(
                    IncidentReport,
                    incident_code=incident_code,
                    time_occurred=occurred_time,
                    incident_type=incident_type,
                    responder_team=random.choice(TEAMS),
                    location=location,
                    address=location,
                    barangay=barangay,
                    latitude=latitude,
                    longitude=longitude,
                    description=description,
                    victim_count=victim_count,
                    action_taken=action_taken,
                    status='Pending',
                    created_by=responder,
                )

                report = IncidentReport.objects.create(**report_kwargs)
                set_created_at(IncidentReport, report.id, created_at)
                linked_reports += 1

                if also_create_incidents and Incident is not None:
                    hazard_type = get_or_create_hazard_type(incident_type)
                    severity_level = random.choice(['low', 'moderate', 'high', 'critical'])
                    status = random.choice(['reported', 'verified', 'ongoing', 'contained', 'resolved'])
                    impact_level = random.choice(['minimal', 'minor', 'major', 'severe'])

                    incident_kwargs = build_create_kwargs(
                        Incident,
                        reference_code=incident_code,
                        hazard_type=hazard_type,
                        latitude=latitude,
                        longitude=longitude,
                        address=location,
                        barangay=barangay,
                        reported_by=responder,
                        incident_datetime=created_at,
                        severity_level=severity_level,
                        status=status,
                        impact_level=impact_level,
                        description=description,
                    )
                    incident = Incident.objects.create(**incident_kwargs)
                    set_created_at(Incident, incident.id, created_at)
                    linked_incidents += 1

                for _ in range(victim_count):
                    victim_barangay = random.choice(BARANGAY_NAMES)
                    VictimDetail.objects.create(
                        incident_report=report,
                        name=fake.name(),
                        age=str(random.randint(1, 85)),
                        gender=random.choice(['M', 'F']),
                        address=f'{victim_barangay}, Lucena City',
                        condition=random.choice(CONDITIONS),
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully generated {count} pending incident reports from {start_year} to {end_year}. '
                f'Report barangay linked: {linked_reports}. '
                f'Incident barangay linked: {linked_incidents}. '
                f'Victim details total: {VictimDetail.objects.count()}. '
                f'All generated reports require manual admin approval.'
            )
        )
