import time
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from accounts.models import AccountProfile, ResidencyVerification
from locations.models import Barangay
from incidents.models import Incident, HazardType
from sms.models import SMSLog

class Command(BaseCommand):
    help = 'Tests geo-targeted SMS alerts with a friend. (Negative test in Talao, Positive test in Iyam)'

    def handle(self, *args, **kwargs):
        # --- CONFIGURATION ---
        # 👇 CHANGE THIS TO YOUR FRIEND'S REAL PHONE NUMBER 👇
        FRIEND_PHONE = '09455874190' 
        # --------------------------------

        self.stdout.write(self.style.WARNING('Starting Geo-Targeted SMS Friend Test...'))
        
        # 1. Get Barangays
        iyam = Barangay.objects.filter(name__icontains='Iyam').first()
        talao = Barangay.objects.filter(name__icontains='Talao').first()
        
        if not iyam or not talao:
            self.stdout.write(self.style.ERROR('❌ Could not find Iyam or Talao in the database. Check your seed data.'))
            return
            
        self.stdout.write(self.style.SUCCESS(f'✅ Found {iyam.name} and {talao.name}'))

        # 2. Setup Friend's Account
        friend, created = User.objects.get_or_create(
            username='friend_geo_test', 
            defaults={'email': 'friend@test.com', 'first_name': 'Friend'}
        )
        profile, _ = AccountProfile.objects.get_or_create(user=friend)
        profile.phone_number = FRIEND_PHONE
        profile.save()
        
        ResidencyVerification.objects.update_or_create(
            user=friend,
            defaults={
                'email': 'friend@test.com',
                'barangay_name': iyam.name,
                'status': ResidencyVerification.STATUS_VERIFIED,
                'residential_address': 'Test Address in Iyam'
            }
        )
        self.stdout.write(self.style.SUCCESS(f'✅ Friend verified in {iyam.name} with phone {FRIEND_PHONE}'))

        # Clear old logs
        SMSLog.objects.filter(phone_number=FRIEND_PHONE).delete()
        hazard = HazardType.objects.get_or_create(name='Fire')[0]

        # ==========================================
        # TEST 1: NEGATIVE TEST (Talao-talao Incident)
        # ==========================================
        self.stdout.write(self.style.WARNING('\n' + '='*50))
        self.stdout.write(self.style.WARNING('TEST 1: Triggering CRITICAL FIRE in TALAO-TALAO...'))
        self.stdout.write(self.style.WARNING('Since friend is in IYAM, they should NOT receive an SMS.'))
        self.stdout.write(self.style.WARNING('='*50))
        
        Incident.objects.create(
            barangay=talao,
            severity_level='critical',
            hazard_type=hazard,
            incident_datetime=timezone.now(),
            latitude=13.9414,   # <--- ✅ ADD THIS
            longitude=121.6236,
            description='Test fire in Talao for friend test'
        )
        
        time.sleep(3) # Give the gateway a moment
        
        logs = SMSLog.objects.filter(phone_number=FRIEND_PHONE)
        if logs.exists():
            self.stdout.write(self.style.ERROR(f'❌ FAIL: SMS was sent! (Check logs)'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ PASS: No SMS sent. Friend is safe!'))

        self.stdout.write(self.style.NOTICE('👉 Check your friend\'s phone now. They should NOT have a new message.'))
        input("\nPress ENTER to proceed to Test 2...")

        # ==========================================
        # TEST 2: POSITIVE TEST (Iyam Incident)
        # ==========================================
        self.stdout.write(self.style.WARNING('\n' + '='*50))
        self.stdout.write(self.style.WARNING('TEST 2: Triggering CRITICAL FIRE in IYAM...'))
        self.stdout.write(self.style.WARNING('Since friend is in IYAM, they SHOULD receive an SMS.'))
        self.stdout.write(self.style.WARNING('='*50))
        
        Incident.objects.create(
            barangay=iyam,
            severity_level='critical',
            hazard_type=hazard,
            incident_datetime=timezone.now(),
            latitude=13.9414,
            longitude=121.6236,
            description='Test fire in Iyam for friend test'
        )
        
        time.sleep(3)
        
        logs = SMSLog.objects.filter(phone_number=FRIEND_PHONE)
        if logs.exists():
            self.stdout.write(self.style.SUCCESS('✅ PASS: SMS sent successfully!'))
            for log in logs:
                self.stdout.write(f"Message: {log.message}")
        else:
            self.stdout.write(self.style.ERROR('❌ FAIL: No SMS was logged. Check gateway.'))

        self.stdout.write(self.style.NOTICE('👉 Check your friend\'s phone now. They SHOULD have a Critical Alert!'))
        self.stdout.write(self.style.SUCCESS('\n✅ All tests complete!'))