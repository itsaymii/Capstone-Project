import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import OneTimePassword, AccountProfile

citizens = User.objects.filter(account_profile__role=AccountProfile.ROLE_CITIZEN).select_related('account_profile')
print('citizens', citizens.count())
print('citizens emails', list(citizens.values_list('email', flat=True)))
print('citizens phone_numbers', list(citizens.values_list('account_profile__phone_number', flat=True)))

otps = OneTimePassword.objects.filter(purpose=OneTimePassword.PURPOSE_REGISTER).order_by('-created_at')[:20]
print('otp count', otps.count())
for otp in otps:
    print('OTP', otp.email, otp.is_used, otp.created_at, otp.payload)
