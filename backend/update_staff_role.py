import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import AccountProfile

user = User.objects.get(email='responder@test.com')
profile = AccountProfile.objects.get(user=user)
print(f"Current role: {profile.role}")

if profile.role != 'staff':
    profile.role = 'staff'
    profile.save()
    print("✓ Updated to staff role")
else:
    print("✓ Already has staff role")
