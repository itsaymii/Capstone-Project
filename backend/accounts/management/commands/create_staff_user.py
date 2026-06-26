from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from accounts.models import AccountProfile


class Command(BaseCommand):
    help = 'Create a staff user for testing responder functionality'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Email address for the staff user')
        parser.add_argument('--username', type=str, default=None, help='Username (defaults to email)')
        parser.add_argument('--password', type=str, default='password123', help='Password for the user')
        parser.add_argument('--name', type=str, default='Responder', help='Full name')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        username = options.get('username') or email
        password = options['password']
        full_name = options['name']

        # Check if user already exists
        if User.objects.filter(email__iexact=email).exists():
            self.stdout.write(self.style.ERROR(f'User with email {email} already exists'))
            return

        # Create the user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=full_name,
        )

        # Create or update the account profile with STAFF role
        profile, created = AccountProfile.objects.get_or_create(
            user=user,
            defaults={'role': AccountProfile.ROLE_STAFF}
        )

        if not created:
            profile.role = AccountProfile.ROLE_STAFF
            profile.save()

        self.stdout.write(
            self.style.SUCCESS(
                f'✓ Staff user created successfully!\n'
                f'  Email: {email}\n'
                f'  Username: {username}\n'
                f'  Password: {password}\n'
                f'  Role: {profile.role}'
            )
        )
