import random
from datetime import datetime, time

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from faker import Faker

from incidents.models import (
    IncidentReport,
    VictimDetail,
    AccomplishmentReport,
)

try:
    from incidents.models import Incident
except Exception:
    Incident = None

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

# Official 33 barangays of Lucena City.
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

LOCATION_COORDINATES = {
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


def get_first_existing_field(model, field_names):
    for field_name in field_names:
        if has_model_field(model, field_name):
            return field_name
    return None


def get_model_field_names(model):
    if model is None:
        return set()
    return {field.name for field in model._meta.get_fields()}


def normalize_name(value):
    return str(value or '').strip().lower().replace('brgy.', 'barangay').replace('brgy ', 'barangay ')


def barangay_candidates(name):
    name = str(name or '').strip()
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
        key = normalize_name(candidate)
        if key not in seen:
            seen.add(key)
            unique.append(candidate)
    return unique


def find_or_create_barangay(name):
    if Barangay is None:
        return None, False

    name_field = get_first_existing_field(Barangay, ['name', 'barangay_name', 'brgy_name', 'title'])
    if not name_field:
        return None, False

    for candidate in barangay_candidates(name):
        barangay = Barangay.objects.filter(**{f'{name_field}__iexact': candidate}).first()
        if barangay:
            return barangay, False

    for candidate in barangay_candidates(name):
        barangay = Barangay.objects.filter(**{f'{name_field}__icontains': candidate}).first()
        if barangay:
            return barangay, False

    create_kwargs = {name_field: name}

    # Fill optional coordinate fields if the Barangay model has them.
    lat, lng = LOCATION_COORDINATES.get(name, (None, None))
    if lat is not None:
        for lat_field in ['latitude', 'lat']:
            if has_model_field(Barangay, lat_field):
                create_kwargs[lat_field] = lat
                break
    if lng is not None:
        for lng_field in ['longitude', 'lng', 'lon']:
            if has_model_field(Barangay, lng_field):
                create_kwargs[lng_field] = lng
                break

    barangay = Barangay.objects.create(**create_kwargs)
    return barangay, True


def get_randomized_coordinates(barangay_name):
    base_lat, base_lng = LOCATION_COORDINATES.get(barangay_name, (13.9414, 121.6236))
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


def build_create_kwargs(model, **kwargs):
    allowed_fields = get_model_field_names(model)
    return {key: value for key, value in kwargs.items() if key in allowed_fields}


def set_created_at(model, object_id, created_at):
    if model is not None and has_model_field(model, 'created_at'):
        model.objects.filter(id=object_id).update(created_at=created_at)


class Command(BaseCommand):
    help = 'Generate pending incident reports connected to Barangay records.'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=50)
        parser.add_argument('--clear', action='store_true')
        parser.add_argument('--start-year', type=int, default=2020)
        parser.add_argument('--end-year', type=int, default=2026)
        parser.add_argument(
            '--also-create-incidents',
            action='store_true',
            help='Also create records in Incident model when your project uses Incident for analytics/map barangay FK.',
        )

    def handle(self, *args, **options):
        count = options['count']
        should_clear = options['clear']
        start_year = options['start_year']
        end_year = options['end_year']
        also_create_incidents = options['also_create_incidents']

        if start_year > end_year:
            self.stdout.write(self.style.ERROR('Invalid year range. start-year must be <= end-year.'))
            return

        if Barangay is None:
            self.stdout.write(self.style.ERROR('locations.models.Barangay could not be imported. Cannot connect barangays.'))
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
            self.stdout.write(self.style.WARNING('Clearing old generated data...'))
            AccomplishmentReport.objects.all().delete()
            VictimDetail.objects.all().delete()
            IncidentReport.objects.all().delete()
            if also_create_incidents and Incident is not None:
                Incident.objects.all().delete()

        report_has_barangay = has_model_field(IncidentReport, 'barangay')
        incident_has_barangay = has_model_field(Incident, 'barangay') if Incident is not None else False

        if not report_has_barangay:
            self.stdout.write(self.style.WARNING('IncidentReport has no barangay FK. Add/migrate barangay field to IncidentReport if reports must store barangay_id.'))
        else:
            self.stdout.write(self.style.SUCCESS('IncidentReport barangay FK detected.'))

        if also_create_incidents:
            if Incident is None:
                self.stdout.write(self.style.WARNING('Incident model could not be imported. Skipping Incident creation.'))
            elif not incident_has_barangay:
                self.stdout.write(self.style.WARNING('Incident has no barangay FK. Incident records will not have barangay_id.'))
            else:
                self.stdout.write(self.style.SUCCESS('Incident barangay FK detected. Incident records will be linked too.'))

        linked_reports = 0
        linked_incidents = 0
        created_barangays = 0
        unlinked_reports = 0

        self.stdout.write(self.style.WARNING(f'Generating {count} pending records from {start_year} to {end_year}...'))

        linked_count = 0
        unlinked_count = 0

        with transaction.atomic():
            for index in range(count):
                created_at = get_random_created_at(start_year, end_year)
                incident_type = random.choice(INCIDENT_TYPES)
                victim_count = random.randint(0, 4)
                barangay_name = random.choice(BARANGAY_NAMES)
                barangay, was_created = find_or_create_barangay(barangay_name)
                if was_created:
                    created_barangays += 1

                location = f'{barangay_name}, Lucena City'
                latitude, longitude = get_randomized_coordinates(barangay_name)
                incident_code = f'INC-{created_at.year}-{index + 1:04d}'
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
                    barangay=barangay if report_has_barangay else None,
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

                if report_has_barangay and barangay is not None:
                    linked_reports += 1
                else:
                    unlinked_reports += 1

                if also_create_incidents and Incident is not None:
                    incident_kwargs = build_create_kwargs(
                        Incident,
                        incident_code=incident_code,
                        code=incident_code,
                        title=incident_type,
                        name=incident_type,
                        incident_type=incident_type,
                        type=incident_type,
                        status='Pending',
                        location=location,
                        address=location,
                        barangay=barangay if incident_has_barangay else None,
                        latitude=latitude,
                        longitude=longitude,
                        description=description,
                        created_by=responder,
                    )
                    incident = Incident.objects.create(**incident_kwargs)
                    set_created_at(Incident, incident.id, created_at)
                    if incident_has_barangay and barangay is not None:
                        linked_incidents += 1

                for _ in range(victim_count):
                    VictimDetail.objects.create(
                        incident_report=report,
                        name=fake.name(),
                        age=str(random.randint(1, 85)),
                        gender=random.choice(['M', 'F']),
                        address=random.choice([f'{name}, Lucena City' for name in BARANGAY_NAMES]),
                        condition=random.choice(CONDITIONS),
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully generated {count} pending incident reports. '
                f'Report barangay linked: {linked_reports}. '
                f'Report not linked: {unlinked_reports}. '
                f'Incident barangay linked: {linked_incidents}. '
                f'Barangays auto-created: {created_barangays}. '
                f'Victim details total: {VictimDetail.objects.count()}.'
            )
        )
