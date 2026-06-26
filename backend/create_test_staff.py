import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import AccountProfile

# Create a staff user for testing
username = 'testresponder'
password = 'TestResponder@123'
email = 'responder@test.com'

try:
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        is_staff=True,
        first_name='Test',
        last_name='Responder'
    )
    
    # Create account profile
    profile = AccountProfile.objects.create(
        user=user,
        role='staff'
    )
    
    print(f"✓ Staff account created successfully!")
    print(f"  Username: {username}")
    print(f"  Password: {password}")
    print(f"  Email: {email}")
except Exception as e:
    print(f"Error: {e}")
