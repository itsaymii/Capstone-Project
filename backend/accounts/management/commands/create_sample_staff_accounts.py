"""
Management command to create sample staff responder accounts for testing.
Run with: python manage.py create_sample_staff_accounts
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from accounts.models import AccountProfile


class Command(BaseCommand):
    help = 'Create sample staff responder accounts for testing'

    def handle(self, *args, **options):
        staff_accounts = [
            {
                'username': 'staff_responder',
                'email': 'staff@responder.com',
                'first_name': 'John',
                'last_name': 'Responder',
                'password': 'Responder@123',
            },
            {
                'username': 'fire_team_lead',
                'email': 'maria.santos@fire.com',
                'first_name': 'Maria',
                'last_name': 'Santos',
                'password': 'FireTeam@123',
            },
            {
                'username': 'medical_responder',
                'email': 'carlos.cruz@ems.com',
                'first_name': 'Carlos',
                'last_name': 'Cruz',
                'password': 'Medical@123',
            },
        ]

        created_count = 0
        for account in staff_accounts:
            username = account['username']
            password = account.pop('password')
            
            # Check if user already exists
            if User.objects.filter(username=username).exists():
                self.stdout.write(
                    self.style.WARNING(f'User "{username}" already exists, skipping...')
                )
                continue
            
            # Create user
            user = User.objects.create_user(**account)
            user.is_staff = True
            user.save()
            
            # Create account profile with staff role
            AccountProfile.objects.create(user=user, role='staff')
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Created staff account: {username}\n'
                    f'  Email: {account["email"]}\n'
                    f'  Password: {password}'
                )
            )
            created_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'\n✓ Successfully created {created_count} staff accounts!')
        )
        self.stdout.write(
            self.style.WARNING(
                '\n⚠️  IMPORTANT: Change these passwords in production!\n'
                'These are sample credentials for development/testing only.'
            )
        )
