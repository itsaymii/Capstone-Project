"""
Management command to create sample staff responder accounts for testing.
Run with: python manage.py create_sample_staff_accounts
"""

import secrets

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
            },
            {
                'username': 'fire_team_lead',
                'email': 'maria.santos@fire.com',
                'first_name': 'Maria',
                'last_name': 'Santos',
            },
            {
                'username': 'medical_responder',
                'email': 'carlos.cruz@ems.com',
                'first_name': 'Carlos',
                'last_name': 'Cruz',
            },
        ]

        created_count = 0
        for account in staff_accounts:
            username = account['username']
            # A new random password each run, so no shared password lives in the repo.
            password = secrets.token_urlsafe(12)
            
            # Check if user already exists
            if User.objects.filter(username=username).exists():
                self.stdout.write(
                    self.style.WARNING(f'User "{username}" already exists, skipping...')
                )
                continue
            
            # Create user
            user = User.objects.create_user(password=password, **account)
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
                '\nThe passwords above are random and shown only once. Save them now.\n'
                'These are sample accounts for development/testing only.'
            )
        )
