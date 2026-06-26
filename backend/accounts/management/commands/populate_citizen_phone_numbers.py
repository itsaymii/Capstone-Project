from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import AccountProfile, OneTimePassword


def _normalize_philippine_phone_number(phone_number: str) -> str:
    if not phone_number:
        return phone_number

    cleaned = phone_number.strip()
    if cleaned.startswith('+63'):
        return cleaned
    if cleaned.startswith('09'):
        return '+63' + cleaned[1:]
    if cleaned.startswith('9') and len(cleaned) == 10:
        return '+63' + cleaned
    return cleaned


class Command(BaseCommand):
    help = (
        'Backfill missing citizen account profile phone numbers from registration OTP payloads.'
    )

    def handle(self, *args, **options):
        citizens = User.objects.filter(account_profile__role=AccountProfile.ROLE_CITIZEN).select_related('account_profile')
        backfilled = 0
        skipped = 0
        missing = 0

        for user in citizens:
            profile = user.account_profile
            if profile.phone_number:
                skipped += 1
                continue

            otp_record = OneTimePassword.objects.filter(
                email__iexact=user.email,
                purpose=OneTimePassword.PURPOSE_REGISTER,
                payload__has_key='phoneNumber',
            ).order_by('-created_at').first()

            if not otp_record:
                missing += 1
                continue

            phone_number = _normalize_philippine_phone_number(otp_record.payload.get('phoneNumber') or '')
            if not phone_number or len(phone_number) < 10:
                missing += 1
                continue

            profile.phone_number = phone_number
            profile.save(update_fields=['phone_number'])
            backfilled += 1

        self.stdout.write(self.style.SUCCESS(
            f'Processed {citizens.count()} citizen accounts. '
            f'Backfilled: {backfilled}. Skipped: {skipped}. Missing phone data: {missing}.'
        ))
