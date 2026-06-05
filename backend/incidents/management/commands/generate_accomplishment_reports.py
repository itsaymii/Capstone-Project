import random
from datetime import timedelta, time, datetime
from decimal import Decimal

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
    'Alpha',
    'Bravo',
    'Charlie',
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
    'Barra, Lucena City',
    'Bocohan, Lucena City',
    'Cotta, Lucena City',
    'Dalahican, Lucena City',
    'Domoit, Lucena City',
    'Gulang-Gulang, Lucena City',
    'Ibabang Dupay, Lucena City',
    'Ibabang Iyam, Lucena City',
    'Ibabang Talim, Lucena City',
    'Ilayang Dupay, Lucena City',
    'Ilayang Iyam, Lucena City',
    'Ilayang Talim, Lucena City',
    'Isabang, Lucena City',
    'Market View, Lucena City',
    'Mayao Castillo, Lucena City',
    'Mayao Crossing, Lucena City',
    'Mayao Kanluran, Lucena City',
    'Mayao Parada, Lucena City',
    'Mayao Silangan, Lucena City',
    'Ransohan, Lucena City',
    'Salinas, Lucena City',
    'Talao-Talao, Lucena City',
]

LOCATION_COORDINATES = {
    'Barangay 1, Lucena City': (13.9389702, 121.6124776),
    'Barangay 2, Lucena City': (13.939363479614258, 121.6145248413086),
    'Barangay 3, Lucena City': (13.9374033, 121.6122379),
    'Barangay 4, Lucena City': (13.9368604, 13.9368604),
    'Barangay 5, Lucena City': (13.935468, 121.6116846),
    'Barangay 6, Lucena City': (13.9342259, 121.6139289),
    'Barangay 7, Lucena City': (13.9332718, 121.6118396),
    'Barangay 8, Lucena City': (13.9268764, 121.6135034),
    'Barangay 9, Lucena City': (13.931232452392578, 121.6135482788086),
    'Barangay 10, Lucena City': (13.9268764, 121.6135034),
    'Barangay 11, Lucena City': (13.9416713, 121.61457),
    'Barra, Lucena City': (13.899703613473259, 121.60599681715252),
    'Bocohan, Lucena City': (13.958983421325684, 121.59123992919922),
    'Cotta, Lucena City': (13.916782260591965, 121.606392873038),
    'Dalahican, Lucena City': (13.906243324279785, 121.61962890625),
    'Domoit, Lucena City': (13.9656741, 121.5954539),
    'Gulang-Gulang, Lucena City': (13.964309692382812, 121.6095962524414),
    'Ibabang Dupay, Lucena City': (13.9413972, 121.6235766),
    'Ibabang Iyam, Lucena City': (13.9262972, 121.6012926),
    'Ibabang Talim, Lucena City': (13.933329582214355, 121.61666870117188),
    'Ilayang Dupay, Lucena City': (13.975142616912596, 121.62297889588788),
    'Ilayang Iyam, Lucena City': (13.9421715, 121.6046099),
    'Ilayang Talim, Lucena City': (13.933329582214355, 121.61666870117188),
    'Isabang, Lucena City': (13.9485716, 121.5838776),
    'Market View, Lucena City': (13.933917045593262, 121.61720275878906),
    'Mayao Castillo, Lucena City': (13.931166648864746, 121.66316986083984),
    'Mayao Crossing, Lucena City': (13.9257621, 121.6217745),
    'Mayao Kanluran, Lucena City': (13.9493974, 121.634851),
    'Mayao Parada, Lucena City': (13.927044090129849, 121.6437013480862),
    'Mayao Silangan, Lucena City': (13.9544415, 121.6468125),
    'Ransohan, Lucena City': (13.893268843518467, 121.5923653381981),
    'Salinas, Lucena City': (13.904104586584326, 121.57631428841128),
    'Talao-Talao, Lucena City': (13.908086776733398, 121.62608337402344),
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


def get_incident_description(incident_type, location):
    descriptions = INCIDENT_DESCRIPTIONS.get(
        incident_type,
        ['Incident reported in the area. Responders conducted assessment and provided necessary emergency assistance.'],
    )
    return f'{random.choice(descriptions)} Location: {location}.'


def get_randomized_coordinates(location):
    base_lat, base_lng = LOCATION_COORDINATES.get(location, (13.9414, 121.6236))

    latitude = round(base_lat + random.uniform(-0.0018, 0.0018), 6)
    longitude = round(base_lng + random.uniform(-0.0018, 0.0018), 6)

    latitude = min(max(latitude, 13.89), 13.98)
    longitude = min(max(longitude, 121.57), 121.69)

    return latitude, longitude




class Command(BaseCommand):
    help = 'Generate incident reports only with clean descriptions, victim details, and approved admin incidents. No accomplishment reports are generated.'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=50)
        parser.add_argument('--days', type=int, default=60)
        parser.add_argument('--clear', action='store_true')

    def handle(self, *args, **options):
        count = options['count']
        days = options['days']
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
            # Detail records (FireDetails, VehicularAccident, etc.) and Incident records
            # will be cascade-deleted via foreign key constraints

        self.stdout.write(self.style.WARNING(f'Generating {count} complete incident report records...'))

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
                    description=get_incident_description(incident_type, location),
                    victim_count=victim_count,
                    action_taken=random.choice(ACTIONS),
                    status=random.choice(['Submitted', 'Pending', 'Approved']),
                    created_by=random.choice(responders),
                )

                IncidentReport.objects.filter(id=report.id).update(created_at=created_at)
                report.created_at = created_at

                # Note: Incident creation is now handled by the post_save signal in signals.py
                # when report.status == 'Approved'. Do not create Incident manually here
                # to avoid UNIQUE constraint violations on reference_code.

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

        approved_count = IncidentReport.objects.filter(status='Approved').count()

        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Successfully generated {count} incident reports, '
                f'{VictimDetail.objects.count()} victim details, '
                f'Approved reports: {approved_count}. '
                f'Note: Incidents are created automatically by the signal when reports are approved.'
            )
        )
