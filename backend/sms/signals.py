# incidents/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta

from .models import Incident
from sms.utils import send_critical_alert
from accounts.models import User 

@receiver(post_save, sender=Incident)
def trigger_critical_sms_alert(sender, instance, created, **kwargs):
    """
    Automatically sends an SMS to all Citizens when a CRITICAL incident 
    is created AND occurred within the last 24 hours.
    """
    # 1. Only trigger when a NEW incident is created
    if not created:
        return

    # 2. Check if the severity is Critical
    if instance.severity_level != 'critical':
        return

    # 3. ✅ NEW: Check the 24-Hour Window
    # This prevents the system from spamming users if an admin backdates an old incident.
    cutoff_time = timezone.now() - timedelta(hours=24)
    
    # ⚠️ ADJUST THIS: Change 'incident_datetime' to your actual date field if it's named differently (e.g., 'created_at', 'date_reported')
    if instance.incident_datetime < cutoff_time:
        return  # Incident is older than 24 hours, do not send SMS.

    # 4. Format the Alert Message
    location = instance.barangay.name if instance.barangay else instance.address
    hazard = instance.hazard_type.name.upper() if instance.hazard_type else "HAZARD"
    
    message = (
        f"DRRMO LUCENA ALERT: A CRITICAL {hazard} incident has been reported at/near {location}. "
        f"Please take immediate precautions and follow safety protocols. Ref: {instance.reference_code}"
    )

    # 5. Query all Citizens with a valid phone number
    # ⚠️ ADJUST THIS: Change 'role' and 'Citizen' to your exact role field and value (e.g., 'user_type', 'CITIZEN').
    # ⚠️ ADJUST THIS: Change 'phone_number' to your exact field name (e.g., 'phone_no').
    citizens = User.objects.filter(
        role='Citizen', 
        phone_number__isnull=False
    ).exclude(phone_number='')

    # 6. Send the SMS to each citizen
    for citizen in citizens:
        send_critical_alert(
            phone_number=citizen.phone_number,
            message=message,
            incident=instance # Link the SMS log to this specific incident
        )