import random
import secrets
from collections import Counter
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from faker import Faker

from incidents.incident_types import validate_report_details
from incidents.models import (
    AccomplishmentReport,
    IncidentReport,
    VictimDetail,
)
from incidents.sample_details import (
    sample_details,
    sample_report_datetime,
    sample_victim_details,
    victim_count_for,
)

try:
    from incidents.models import Incident, HazardType
except Exception:
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

BARANGAY_NAMES = [
    'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5',
    'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Barangay 10',
    'Barangay 11', 'Barra', 'Bocohan', 'Cotta', 'Dalahican', 'Domoit',
    'Gulang-Gulang', 'Ibabang Dupay', 'Ibabang Iyam', 'Ibabang Talim',
    'Ilayang Dupay', 'Ilayang Iyam', 'Ilayang Talim', 'Isabang', 'Market View',
    'Mayao Castillo', 'Mayao Crossing', 'Mayao Kanluran', 'Mayao Parada',
    'Mayao Silangan', 'Ransohan', 'Salinas', 'Talao-Talao',
]

# Places in Lucena with documented incidents of each type (the team's research, Oct 2026).
# Each entry: (barangay, landmark used in the report location, water body for drownings).
HOTSPOTS = {
    # NDRRMC accident report, 2024
    'RCA': [('Domoit', 'Diversion Road, Stone Gate area', None)],
    'Fire Incident': [
        ('Ibabang Dupay', 'Alpsville 3 Subdivision', None),  # fire report, 2025 (Brigada News)
        ('Barangay 1', 'residential apartment area', None),  # fire reports, 2024 (Inquirer)
    ],
    'Drowning': [
        ('Talao-Talao', 'Purok Spillway, Talao-talao River', 'river'),  # NDRRMC report, 2024
        ('Talao-Talao', 'coastal resort area', 'sea'),  # local drowning reports, 2021 and 2024
    ],
    # MSEUF research on burglary, theft and victimization
    'Crime Against Person/Property': [('Ibabang Dupay', 'University Site Village', None)],
}

# Share of each type's reports placed at its hotspots; the rest are spread over all barangays.
HOTSPOT_SHARE = {
    'RCA': 0.45,
    'Fire Incident': 0.5,
    'Drowning': 0.6,
    'Crime Against Person/Property': 0.3,
}

# PNP reported more property crimes from December 2024 into January 2025.
PROPERTY_CRIME_SURGE_MONTHS = {(2024, 12), (2025, 1)}
PROPERTY_CRIME_SURGE_WEIGHT = 3

BARANGAY_COORDINATES = {
    'Barangay 1': (13.9389702, 121.6124776), 'Barangay 2': (13.939363479614258, 121.6145248413086),
    'Barangay 3': (13.9374033, 121.6122379), 'Barangay 4': (13.9368604, 121.6128604),
    'Barangay 5': (13.935468, 121.6116846), 'Barangay 6': (13.9342259, 121.6139289),
    'Barangay 7': (13.9332718, 121.6118396), 'Barangay 8': (13.9268764, 121.6135034),
    'Barangay 9': (13.931232452392578, 121.6135482788086), 'Barangay 10': (13.9268764, 121.6135034),
    'Barangay 11': (13.9416713, 121.61457), 'Barra': (13.899703613473259, 121.60599681715252),
    'Bocohan': (13.958983421325684, 121.59123992919922), 'Cotta': (13.916782260591965, 121.606392873038),
    'Dalahican': (13.906243324279785, 121.61962890625), 'Domoit': (13.9656741, 121.5954539),
    'Gulang-Gulang': (13.964309692382812, 121.6095962524414), 'Ibabang Dupay': (13.9413972, 121.6235766),
    'Ibabang Iyam': (13.9262972, 121.6012926), 'Ibabang Talim': (13.933329582214355, 121.61666870117188),
    'Ilayang Dupay': (13.975142616912596, 121.62297889588788), 'Ilayang Iyam': (13.9421715, 121.6046099),
    'Ilayang Talim': (13.933329582214355, 121.61666870117188), 'Isabang': (13.9485716, 121.5838776),
    'Market View': (13.933917045593262, 121.61720275878906), 'Mayao Castillo': (13.931166648864746, 121.66316986083984),
    'Mayao Crossing': (13.9257621, 121.6217745), 'Mayao Kanluran': (13.9493974, 121.634851),
    'Mayao Parada': (13.927044090129849, 121.6437013480862), 'Mayao Silangan': (13.9544415, 121.6468125),
    'Ransohan': (13.893268843518467, 121.5923653381981), 'Salinas': (13.904104586584326, 121.57631428841128),
    'Talao-Talao': (13.908086776733398, 121.62608337402344),
}

CONDITIONS = [
    'Conscious and oriented', 'Minor abrasion', 'Laceration on arm',
    'Complaining of chest pain', 'Difficulty breathing', 'Suspected fracture',
    'Dizziness', 'Weakness', 'Transported to hospital',
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
    if model is None: return False
    return any(field.name == field_name for field in model._meta.get_fields())

def get_model_field_names(model):
    if model is None: return set()
    return {field.name for field in model._meta.get_fields()}

def get_first_existing_field(model, candidate_fields):
    for field_name in candidate_fields:
        if has_model_field(model, field_name): return field_name
    return None

def build_create_kwargs(model, **kwargs):
    allowed_fields = get_model_field_names(model)
    return {key: value for key, value in kwargs.items() if key in allowed_fields}

def normalize_barangay_name(value):
    return str(value or '').replace(', Lucena City', '').replace('Brgy.', 'Barangay').replace('Brgy ', 'Barangay ').strip().lower()

def barangay_candidates(barangay_name):
    name = str(barangay_name or '').replace(', Lucena City', '').strip()
    if not name: return []
    candidates = [name]
    if name.lower().startswith('barangay '):
        number = name.split(' ', 1)[1].strip()
        candidates.extend([f'Brgy. {number}', f'Brgy {number}', number])
    else:
        candidates.extend([f'Barangay {name}', f'Brgy. {name}', f'Brgy {name}'])
    unique, seen = [], set()
    for candidate in candidates:
        key = normalize_barangay_name(candidate)
        if key not in seen:
            seen.add(key)
            unique.append(candidate)
    return unique

def find_barangay(barangay_name):
    if Barangay is None: return None
    name_field = get_first_existing_field(Barangay, ['name', 'barangay_name', 'brgy_name', 'title'])
    if not name_field: return None
    candidates = barangay_candidates(barangay_name)
    for candidate in candidates:
        barangay = Barangay.objects.filter(**{f'{name_field}__iexact': candidate}).first()
        if barangay: return barangay
    normalized_target = normalize_barangay_name(barangay_name)
    for barangay in Barangay.objects.all():
        current_name = normalize_barangay_name(getattr(barangay, name_field, ''))
        if current_name == normalized_target: return barangay
    for candidate in candidates:
        barangay = Barangay.objects.filter(**{f'{name_field}__icontains': candidate}).first()
        if barangay: return barangay
    return None

def get_randomized_coordinates(barangay_name):
    base_lat, base_lng = BARANGAY_COORDINATES.get(barangay_name, (13.9414, 121.6236))
    latitude = round(base_lat + random.uniform(-0.0018, 0.0018), 6)
    longitude = round(base_lng + random.uniform(-0.0018, 0.0018), 6)
    return min(max(latitude, 13.89), 13.98), min(max(longitude, 121.57), 121.69)

def _boundary_rings(boundary):
    """Outer rings of a GeoJSON Polygon/MultiPolygon, as lists of (lng, lat)."""
    geometry_type = (boundary or {}).get('type')
    coordinates = (boundary or {}).get('coordinates') or []
    if geometry_type == 'Polygon':
        return [coordinates[0]] if coordinates else []
    if geometry_type == 'MultiPolygon':
        return [polygon[0] for polygon in coordinates if polygon]
    return []

def _inside_ring(lng, lat, ring):
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > lat) != (y2 > lat) and lng < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside

def get_point_in_barangay(rng, barangay, barangay_name):
    """A random point inside the barangay's boundary, so map markers land in the right barangay."""
    rings = _boundary_rings(getattr(barangay, 'boundary', None))
    if rings:
        points = [point for ring in rings for point in ring]
        min_lng, max_lng = min(p[0] for p in points), max(p[0] for p in points)
        min_lat, max_lat = min(p[1] for p in points), max(p[1] for p in points)
        for _ in range(200):
            lng, lat = rng.uniform(min_lng, max_lng), rng.uniform(min_lat, max_lat)
            if any(_inside_ring(lng, lat, ring) for ring in rings):
                return round(lat, 6), round(lng, 6)
    return get_randomized_coordinates(barangay_name)

def get_incident_description(incident_type, location):
    descriptions = INCIDENT_DESCRIPTIONS.get(incident_type, ['Incident reported in the area. Responders conducted assessment and provided necessary emergency assistance.'])
    return f'{random.choice(descriptions)} Location: {location}.'

def get_hazard_name_for_incident_type(incident_type):
    normalized = incident_type.lower()
    if 'fire' in normalized: return 'Fire'
    if 'rca' in normalized or 'road' in normalized or 'accident' in normalized: return 'Accident'
    if 'medical' in normalized or 'ambulance' in normalized or 'stand-by' in normalized: return 'Medical Emergency'
    if 'crime' in normalized: return 'Crime'
    if 'drowning' in normalized: return 'Drowning'
    return 'Incident'

def get_or_create_hazard_type(incident_type):
    if HazardType is None: return None
    hazard_name = get_hazard_name_for_incident_type(incident_type)
    hazard, _ = HazardType.objects.get_or_create(name=hazard_name, defaults={'description': f'Auto-generated hazard type for {hazard_name}.'})
    return hazard


def get_severity_and_impact(incident_type, barangay_name, victim_count):
    lower = (incident_type or '').lower()
    if 'fire' in lower:
        return 'critical', 'major'
    if 'rca' in lower or 'vehicular' in lower or 'accident' in lower:
        if barangay_name in {name for name, _, _ in HOTSPOTS['RCA']}:
            return 'high', 'major'
        return ('high', 'major') if victim_count >= 2 else ('moderate', 'minor')
    if 'crime' in lower or 'drowning' in lower:
        return 'high', 'major'
    if 'medical' in lower or 'ambulance' in lower or 'stand-by' in lower:
        return ('high', 'major') if victim_count >= 2 else ('moderate', 'minor')
    return 'moderate', 'minor'


def set_created_at(model, object_id, created_at):
    if model is not None and has_model_field(model, 'created_at'):
        model.objects.filter(id=object_id).update(created_at=created_at)

def get_place_for_incident(rng, incident_type):
    """
    (barangay, landmark, water body) for one report. A share of each type goes to its
    documented hotspots (HOTSPOTS); everything else is spread over all 33 barangays.
    """
    hotspots = HOTSPOTS.get(incident_type)
    if hotspots and rng.random() < HOTSPOT_SHARE.get(incident_type, 0):
        return rng.choice(hotspots)
    return rng.choice(BARANGAY_NAMES), None, None

def plan_places(rng, incident_types, min_per_barangay):
    """
    A place for each report, making sure every barangay gets at least `min_per_barangay`
    reports. Barangays that came up short take reports from the most-used barangays;
    hotspot reports are never moved.
    """
    places = [get_place_for_incident(rng, incident_type) for incident_type in incident_types]
    counts = Counter(place[0] for place in places)

    for name in rng.sample(BARANGAY_NAMES, len(BARANGAY_NAMES)):
        while counts[name] < min_per_barangay:
            movable = [
                index for index, (barangay, landmark, _) in enumerate(places)
                if landmark is None and counts[barangay] > min_per_barangay
            ]
            if not movable:
                break  # too few reports to give every barangay the minimum
            index = max(movable, key=lambda i: (counts[places[i][0]], rng.random()))
            counts[places[index][0]] -= 1
            places[index] = (name, None, None)
            counts[name] += 1

    return places


# How often each incident type appears in the sample data (roughly like a city DRRMO's mix).
TYPE_WEIGHTS = {
    'RCA': 25,
    'Medical Emergency': 20,
    'Ambulance Assistance': 14,
    'Crime Against Person/Property': 12,
    'Stand-by Medical Team': 12,
    'Fire Incident': 10,
    'Drowning': 7,
}

ACTIONS_BY_TYPE = {
    'RCA': [
        'Secured the scene, provided first aid, and coordinated traffic control with PNP.',
        'Immobilized injured persons and transported them to the nearest hospital.',
        'Assessed all persons involved; minor injuries treated on site.',
    ],
    'Fire Incident': [
        'Assisted BFP with evacuation and crowd control; treated minor burns and smoke inhalation.',
        'Set up a first aid station near the fire scene and monitored affected families.',
        'Coordinated temporary shelter for displaced families with the barangay.',
    ],
    'Crime Against Person/Property': [
        'Provided first aid to the victim and endorsed the case to PNP.',
        'Secured the area until PNP arrived and documented the incident.',
    ],
    'Medical Emergency': [
        'Performed initial assessment, monitored vital signs, and transported the patient.',
        'Provided oxygen support and continuous monitoring during transport.',
        'Gave first aid on site; patient refused hospital transfer after assessment.',
    ],
    'Ambulance Assistance': [
        'Transported the patient safely to the receiving hospital and endorsed to the ER staff.',
        'Provided monitoring during transport; patient endorsed to the receiving facility.',
    ],
    'Stand-by Medical Team': [
        'Maintained a first aid station throughout the event and attended to minor cases.',
        'Roving medical team stationed at the venue; no major incidents recorded.',
    ],
    'Drowning': [
        'Conducted water rescue, performed CPR, and transported victims to the hospital.',
        'Coordinated search and retrieval with the Coast Guard and barangay volunteers.',
    ],
}

INCIDENT_FINAL_STATUSES = ['verified', 'ongoing', 'contained', 'resolved']


def next_code_numbers(prefix_template):
    """Highest number already used per year for codes like INC-2026-00012, from reports and incidents."""
    import re
    pattern = re.compile(prefix_template.replace('{year}', r'(\d{4})') + r'(\d+)$')
    highest = {}
    sources = [IncidentReport.objects.values_list('incident_code', flat=True),
               IncidentReport.objects.values_list('report_code', flat=True)]
    if Incident is not None:
        sources.append(Incident.objects.values_list('reference_code', flat=True))
    for source in sources:
        for code in source:
            match = pattern.match(code or '')
            if match:
                year, number = int(match.group(1)), int(match.group(2))
                highest[year] = max(highest.get(year, 0), number)
    return highest


def final_incident_status(rng, occurred_at, now):
    """Older incidents are mostly resolved; recent ones may still be ongoing."""
    age_days = (now - occurred_at).days
    if age_days > 30:
        return rng.choices(INCIDENT_FINAL_STATUSES, weights=[5, 3, 12, 80])[0]
    if age_days > 3:
        return rng.choices(INCIDENT_FINAL_STATUSES, weights=[15, 20, 25, 40])[0]
    return rng.choices(INCIDENT_FINAL_STATUSES, weights=[40, 40, 15, 5])[0]


class Command(BaseCommand):
    help = (
        'Generate realistic sample responder reports, with type-specific details and victims, '
        'spread across Lucena barangays and dates. Use --approved to also create the linked incidents.'
    )

    def add_arguments(self, parser):
        now_year = timezone.localtime().year
        parser.add_argument('--count', type=int, default=200, help='Number of reports to create (default 200).')
        parser.add_argument('--start-year', type=int, default=now_year - 3, help='Earliest year (default: 3 years ago).')
        parser.add_argument('--end-year', type=int, default=now_year, help='Latest year (default: this year).')
        parser.add_argument('--recent-share', type=float, default=0.3,
                            help='Share of reports in the last 120 days, so recent views have data (default 0.3).')
        parser.add_argument('--approved', action='store_true',
                            help='Save reports as Approved, which creates the linked Incident and detail rows.')
        parser.add_argument('--also-create-incidents', action='store_true',
                            help='With pending reports, still create Incident rows directly.')
        parser.add_argument('--seed', type=int, default=None, help='Use the same seed to get the same data again.')
        parser.add_argument('--min-per-barangay', type=int, default=None,
                            help='Every barangay gets at least this many reports '
                                 '(default 3, or fewer when --count is too small for 3 each).')
        parser.add_argument('--clear', action='store_true',
                            help='Delete ALL incident reports, victims, and accomplishment reports first '
                                 '(and ALL incidents when used with --approved or --also-create-incidents).')

    def handle(self, *args, **options):
        count = options['count']
        start_year, end_year = options['start_year'], options['end_year']
        approved = options['approved']
        also_create_incidents = options['also_create_incidents'] and not approved and Incident is not None
        recent_share = options['recent_share']

        if count < 0:
            raise CommandError('count must be 0 or higher.')
        if start_year > end_year:
            raise CommandError('start-year must not be after end-year.')
        if not 0 <= recent_share <= 1:
            raise CommandError('recent-share must be between 0 and 1.')
        min_per_barangay = options['min_per_barangay']
        if min_per_barangay is None:
            min_per_barangay = min(3, count // len(BARANGAY_NAMES))
        if min_per_barangay < 0:
            raise CommandError('min-per-barangay must be 0 or higher.')
        if count < min_per_barangay * len(BARANGAY_NAMES):
            raise CommandError(
                f'count must be at least {min_per_barangay * len(BARANGAY_NAMES)} so each of the '
                f'{len(BARANGAY_NAMES)} barangays gets {min_per_barangay} reports (or lower --min-per-barangay).'
            )
        missing_in_database = [name for name in BARANGAY_NAMES if find_barangay(name) is None]
        if missing_in_database:
            raise CommandError(
                f'These barangays are not in the database: {", ".join(missing_in_database)}. '
                'Run: python manage.py import_barangays ../lucena_barangays.geojson'
            )
        if Barangay is None or not has_model_field(IncidentReport, 'barangay'):
            raise CommandError('Barangays are not available. Run: python manage.py import_barangays ../lucena_barangays.geojson')

        seed = options['seed']
        rng = random.Random(seed)
        if seed is not None:
            random.seed(seed)  # helpers above (barangays, coordinates) use the random module
            Faker.seed(seed)

        User = get_user_model()
        responders = list(User.objects.filter(is_staff=True, is_superuser=False)) or list(User.objects.filter(is_staff=True))
        if not responders:
            demo_password = secrets.token_urlsafe(12)
            responders = [User.objects.create_user(
                username='field_responder', email='responder@example.com', password=demo_password, is_staff=True,
            )]
            self.stdout.write(self.style.WARNING(f'No staff accounts found: created field_responder / {demo_password}'))

        now = timezone.localtime()
        types = list(TYPE_WEIGHTS)
        plans = []
        for _ in range(count):
            reported_at = sample_report_datetime(rng, start_year, end_year, now, recent_share=recent_share)
            surge = (reported_at.year, reported_at.month) in PROPERTY_CRIME_SURGE_MONTHS
            weights = [
                TYPE_WEIGHTS[t] * (PROPERTY_CRIME_SURGE_WEIGHT if surge and t == 'Crime Against Person/Property' else 1)
                for t in types
            ]
            plans.append((reported_at, rng.choices(types, weights=weights)[0]))
        plans.sort(key=lambda plan: plan[0])  # codes go up with the date, like real reports
        places = plan_places(rng, [incident_type for _, incident_type in plans], min_per_barangay)

        summary = {incident_type: 0 for incident_type in types}
        victims_total = 0
        missing_barangays = set()
        per_barangay = Counter()

        # Clearing and creating happen together: if anything fails, the old data is kept.
        with transaction.atomic():
            if options['clear']:
                self.stdout.write(self.style.WARNING('Clearing existing reports...'))
                AccomplishmentReport.objects.all().delete()
                VictimDetail.objects.all().delete()
                IncidentReport.objects.all().delete()
                if (approved or also_create_incidents) and Incident is not None:
                    Incident.objects.all().delete()

            next_incident = next_code_numbers('INC-{year}-')
            next_report = next_code_numbers('IR-{year}-')

            for (reported_at, incident_type), (barangay_name, landmark, water_body) in zip(plans, places):
                barangay = find_barangay(barangay_name)
                if barangay is None:
                    missing_barangays.add(barangay_name)
                    continue

                occurred_at = reported_at - timedelta(minutes=rng.randint(10, 90))
                year = occurred_at.year
                next_incident[year] = next_incident.get(year, 0) + 1
                next_report[reported_at.year] = next_report.get(reported_at.year, 0) + 1

                location = f'{landmark}, {barangay_name}, Lucena City' if landmark else f'{barangay_name}, Lucena City'
                latitude, longitude = get_point_in_barangay(rng, barangay, barangay_name)
                victim_count = victim_count_for(rng, incident_type)
                details = sample_details(rng, incident_type, victim_count, occurred_at, barangay_name)
                if water_body:
                    details['water_body'] = water_body
                if (
                    incident_type == 'Crime Against Person/Property'
                    and (reported_at.year, reported_at.month) in PROPERTY_CRIME_SURGE_MONTHS
                    and rng.random() < 0.7
                ):
                    # The PNP-reported rise was in property crimes: theft and robbery.
                    details['crime_type'] = rng.choice(['theft', 'theft', 'robbery'])
                    if details['crime_type'] == 'theft':
                        details['weapon'] = 'none'
                victims = [sample_victim_details(rng, incident_type, details) for _ in range(victim_count)]

                cleaned, victim_details, errors = validate_report_details(
                    incident_type, details, [{'details': victim} for victim in victims],
                )
                if errors:
                    raise CommandError(f'Sample data failed validation for {incident_type}: {errors}')

                responder = rng.choice(responders)
                # Real reports use the logged-in responder account as the team (see the serializer),
                # so the responder pages and team performance charts can match them.
                responder_team = (f'{responder.first_name} {responder.last_name}'.strip() or responder.username)[:100]
                report = IncidentReport.objects.create(
                    report_code=f'IR-{reported_at.year}-{next_report[reported_at.year]:05d}',
                    incident_code=f'INC-{year}-{next_incident[year]:05d}',
                    time_occurred=occurred_at.time().replace(second=0, microsecond=0),
                    incident_type=incident_type,
                    responder_team=responder_team,
                    location=location,
                    barangay=barangay,
                    latitude=latitude,
                    longitude=longitude,
                    description=get_incident_description(incident_type, location),
                    victim_count=victim_count,
                    action_taken=rng.choice(ACTIONS_BY_TYPE.get(incident_type, ACTIONS)),
                    status='Approved' if approved else 'Pending',
                    details=cleaned,
                    created_by=responder,
                )
                IncidentReport.objects.filter(id=report.id).update(created_at=reported_at)

                for extra in victim_details:
                    VictimDetail.objects.create(
                        incident_report=report,
                        name=fake.name(),
                        age=str(rng.randint(5, 80)),
                        gender=rng.choice(['M', 'F']),
                        # Most victims live in the barangay where it happened.
                        address=f'{barangay_name if rng.random() < 0.7 else rng.choice(BARANGAY_NAMES)}, Lucena City',
                        condition=rng.choice(CONDITIONS),
                        details=extra,
                    )
                victims_total += victim_count

                if approved and Incident is not None:
                    # The approval signal created the incident with today's date; give it the real dates.
                    Incident.objects.filter(reference_code=report.incident_code).update(
                        incident_datetime=occurred_at,
                        date_reported=reported_at,
                        created_at=reported_at,
                        status=final_incident_status(rng, occurred_at, now),
                    )
                elif also_create_incidents:
                    severity_level, impact_level = get_severity_and_impact(incident_type, barangay_name, victim_count)
                    incident = Incident.objects.create(**build_create_kwargs(
                        Incident,
                        reference_code=report.incident_code, hazard_type=get_or_create_hazard_type(incident_type),
                        latitude=latitude, longitude=longitude, address=location, barangay=barangay,
                        reported_by=responder, incident_datetime=occurred_at, severity_level=severity_level,
                        status=final_incident_status(rng, occurred_at, now), impact_level=impact_level,
                        description=report.description,
                    ))
                    set_created_at(Incident, incident.id, reported_at)

                summary[incident_type] += 1
                per_barangay[barangay_name] += 1

        if missing_barangays:
            self.stdout.write(self.style.WARNING(
                f'Skipped reports for barangays not in the database: {", ".join(sorted(missing_barangays))}. '
                'Run import_barangays first.'
            ))

        created = sum(summary.values())
        if created:
            fewest = min(per_barangay[name] for name in BARANGAY_NAMES)
            self.stdout.write(
                f'Every barangay has at least {fewest} new reports '
                f'({sum(1 for name in BARANGAY_NAMES if per_barangay[name])} of {len(BARANGAY_NAMES)} barangays have data).'
            )
        self.stdout.write(self.style.SUCCESS(
            f'Created {created} {"approved" if approved else "pending"} reports '
            f'({start_year}-{end_year}, {victims_total} victims).'
        ))
        for incident_type, number in summary.items():
            self.stdout.write(f'  {incident_type}: {number}')
        if approved:
            self.stdout.write('Linked incidents and detail rows (fire_details, vehicular_accidents, ...) were created.')
            self.stdout.write('Next: python manage.py calculate_risk_scores --days 365')
        else:
            self.stdout.write('Reports are Pending: approve them in Admin Dashboard > Mapping to create incidents.')