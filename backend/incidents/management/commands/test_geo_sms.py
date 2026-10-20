from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from accounts.models import AccountProfile, ResidencyVerification
from locations.models import Barangay
from incidents.models import Incident, HazardType
from sms.models import SMSLog
from django.utils import timezone

class Command(BaseCommand):
    help = 'Tests the geo-targeted SMS signal for critical incidents.'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Starting Geo-Targeted SMS Signal Test...'))

        # 1. Get a REAL barangay from your JSON-seeded database
        barangay = Barangay.objects.filter(name__icontains='Talao').first()
        if not barangay:
            self.stdout.write(self.style.ERROR('❌ ERROR: Could not find a barangay. Check your database seed.'))
            return
        self.stdout.write(self.style.SUCCESS(f'✅ Using real barangay: {barangay.name}'))

        # 2. Create or get a test user
        user, created = User.objects.get_or_create(
            username='test_sms_user',
            defaults={'email': 'test@sms.com', 'first_name': 'Test', 'last_name': 'User'}
        )
        if created:
            user.set_password('TestPass123!')
            user.save()
            self.stdout.write('👤 Created test user.')
        else:
            self.stdout.write('👤 User already exists.')

        # Ensure they have an AccountProfile with a dummy phone number
        profile, _ = AccountProfile.objects.get_or_create(user=user)
        if not profile.phone_number:
            profile.phone_number = '09911449613' # Dummy PH number
            profile.save()
            self.stdout.write('📱 Added dummy phone number to profile.')

        # 3. Create a VERIFIED Residency for this user in the REAL barangay
        residency, _ = ResidencyVerification.objects.get_or_create(
            user=user,
            defaults={
                'email': user.email,
                'barangay_name': barangay.name,
                'residential_address': '123 Test St',
                'status': ResidencyVerification.STATUS_VERIFIED,
                'proof_document_name': 'test_cert.jpg'
            }
        )
        self.stdout.write(self.style.SUCCESS(f'✅ Residency verified for {barangay.name}.'))

        # 4. Create a Hazard Type
        hazard, _ = HazardType.objects.get_or_create(name='Fire')

        # 5. Clear old SMS logs for this number so we can see the new one clearly
        SMSLog.objects.filter(phone_number='09911449613').delete()

        # 6. Create the CRITICAL Incident (This will trigger the signal!)
        self.stdout.write(self.style.WARNING('\n🚨 TRIGGERING SIGNAL: Creating Critical Incident...'))
        incident = Incident.objects.create(
            hazard_type=hazard,
            barangay=barangay, # <--- The magic link!
            severity_level='critical',
            status='verified',
            incident_datetime=timezone.now(),
            latitude=13.9414,
            longitude=121.6236,
            address='Near the plaza',
            description='Test fire incident for SMS signal'
        )
        self.stdout.write(self.style.SUCCESS('✅ Incident created.'))

        # 7. Check the results
        self.stdout.write(self.style.WARNING('\n--- SMS LOG RESULTS ---'))
        logs = SMSLog.objects.filter(phone_number='09123456789')
        if logs.exists():
            for log in logs:
                self.stdout.write(f"Status: {self.style.SUCCESS(log.status)} | Message: {log.message[:60]}...")
        else:
            self.stdout.write(self.style.ERROR("⚠️ No SMS was logged. (Check if your SMS gateway is running or if it was rate-limited)."))

        self.stdout.write(self.style.SUCCESS('\n✅ Test complete!'))