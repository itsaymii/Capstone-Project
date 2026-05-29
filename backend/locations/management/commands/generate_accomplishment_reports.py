import random
from datetime import timedelta, time

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from faker import Faker

from incidents.models import IncidentReport, VictimDetail, AccomplishmentReport

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


class Command(BaseCommand):
    help = 'Generate dummy IncidentReport, VictimDetail, and AccomplishmentReport data for responder frontend tables.'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=100)
        parser.add_argument('--days', type=int, default=60)
        parser.add_argument('--compile', type=int, default=20)
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
            self.stdout.write(self.style.WARNING('Clearing old responder report data...'))
            AccomplishmentReport.objects.all().delete()
            VictimDetail.objects.all().delete()
            IncidentReport.objects.all().delete()

        self.stdout.write(f'Generating {count} incident reports...')

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

                report = IncidentReport.objects.create(
                    incident_code=f'INC-{created_at.year}-{index + 1:03d}',
                    time_occurred=time(
                        hour=random.randint(0, 23),
                        minute=random.randint(0, 59),
                    ),
                    incident_type=incident_type,
                    responder_team=random.choice(TEAMS),
                    location=random.choice(LOCATIONS),
                    description=f'{incident_type} reported at {random.choice(LOCATIONS)}. {fake.sentence()}',
                    victim_count=victim_count,
                    action_taken=random.choice(ACTIONS),
                    status='Submitted',
                    created_by=random.choice(responders),
                )

                IncidentReport.objects.filter(id=report.id).update(created_at=created_at)
                report.created_at = created_at

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

            reports_for_compile = created_reports[:]

            for _ in range(min(compile_count, max(1, count // 3))):
                batch_size = random.randint(1, min(5, len(reports_for_compile)))
                selected_reports = random.sample(reports_for_compile, batch_size)

                accomplishment = AccomplishmentReport.objects.create(
                    title='Accomplishment Report',
                    total_reports=len(selected_reports),
                    status='Compiled',
                    compiled_by=random.choice(responders),
                )
                accomplishment.incident_reports.set(selected_reports)

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully generated {count} incident reports and accomplishment reports.'
            )
        )