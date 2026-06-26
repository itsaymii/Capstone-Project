from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import timedelta, datetime

from incidents.models import Incident, IncidentReport
from sms.utils import send_critical_alert
from accounts.models import AccountProfile
from .models import SMSLog

User = get_user_model()

# store old severity before save
@receiver(pre_save, sender=Incident)
def _capture_old_severity(sender, instance, **kwargs):
    if instance.pk:
        try:
            old = Incident.objects.get(pk=instance.pk)
            instance._old_severity = (old.severity_level or '').lower()
        except Incident.DoesNotExist:
            instance._old_severity = None
    else:
        instance._old_severity = None

@receiver(post_save, sender=Incident)
def trigger_critical_sms_alert(sender, instance, created, **kwargs):
    """
    Automatically sends an SMS to all Citizens when a CRITICAL incident 
    is created AND occurred within the last 24 hours.
    """
    # Allow alerts when either:
    # - a new Incident is created with severity 'critical', or
    # - an existing Incident's severity transitions from non-critical -> 'critical'.
    new_severity = (instance.severity_level or '').lower()
    old_severity = getattr(instance, '_old_severity', None)

    created_and_critical = created and new_severity == 'critical'
    became_critical = (not created) and old_severity != 'critical' and new_severity == 'critical'

    if not (created_and_critical or became_critical):
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
    # Accept stored phone numbers that start with '+63' or '09'
    from django.db.models import Q

    citizens = User.objects.filter(
        account_profile__role=AccountProfile.ROLE_CITIZEN,
        account_profile__phone_number__isnull=False,
    ).filter(
        Q(account_profile__phone_number__startswith='+63') | Q(account_profile__phone_number__startswith='09')
    ).exclude(account_profile__phone_number='')

    # 6. Send the SMS to each citizen
    for citizen in citizens:
        phone_number = citizen.account_profile.phone_number
        if not phone_number:
            continue

        send_critical_alert(
            phone_number=phone_number,
            message=message,
            incident=instance,
        )


def _map_severity(incident_type, victim_count):
    lower = (incident_type or '').lower()
    if victim_count >= 5:
        return 'critical'
    if victim_count >= 3:
        return 'high'
    if 'fire' in lower or 'drowning' in lower or 'crime' in lower:
        return 'moderate'
    if victim_count > 0:
        return 'moderate'
    return 'low'


@receiver(post_save, sender=IncidentReport)
def trigger_sms_on_report_approval(sender, instance, created, **kwargs):
    """
    Send critical SMS when an IncidentReport is approved by an admin.
    This complements the Incident-created signal and provides a direct
    alert path from approval -> citizens. Duplicate sends are avoided
    by checking recent SMSLog entries containing the report's reference.
    """
    try:
        if str(instance.status).lower() != 'approved':
            return

        # Compute a datetime for the report occurrence to enforce 24h cutoff
        reported_time = instance.time_occurred
        if reported_time:
            occurred_dt = timezone.make_aware(
                datetime.combine(timezone.localtime().date(), reported_time)
            )
        else:
            occurred_dt = timezone.now()

        if occurred_dt < (timezone.now() - timedelta(hours=24)):
            return

        severity = _map_severity(instance.incident_type, instance.victim_count)
        if severity != 'critical':
            return

        # Prevent duplicate alerts for the same report/incident reference
        ref = getattr(instance, 'incident_code', None) or ''
        if ref and SMSLog.objects.filter(message__icontains=ref).exists():
            return

        location = instance.barangay.name if getattr(instance, 'barangay', None) else instance.location or ''
        hazard = (instance.incident_type or 'HAZARD').upper()

        message = (
            f"DRRMO LUCENA ALERT: A CRITICAL {hazard} incident has been reported at/near {location}. "
            f"Please take immediate precautions and follow safety protocols. Ref: {ref}"
        )

        # Accept stored phone numbers that start with '+63' or '09'
        from django.db.models import Q

        citizens = User.objects.filter(
            account_profile__role=AccountProfile.ROLE_CITIZEN,
            account_profile__phone_number__isnull=False,
        ).filter(
            Q(account_profile__phone_number__startswith='+63') | Q(account_profile__phone_number__startswith='09')
        ).exclude(account_profile__phone_number='')

        for citizen in citizens:
            phone_number = citizen.account_profile.phone_number
            if not phone_number:
                continue

            send_critical_alert(
                phone_number=phone_number,
                message=message,
                incident=None,
            )

    except Exception:
        # Fail silently in signal handlers
        return