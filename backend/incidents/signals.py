from django.db.models.signals import post_save
from .utils import get_nearest_barangay
from django.dispatch import receiver
from django.utils import timezone
from datetime import datetime
from decimal import Decimal
from sms.utils import send_critical_alert
from accounts.models import ResidencyVerification

from .models import (
    IncidentReport,
    Incident,
    HazardType,
    FireDetails,
    VehicularAccident,
    CrimeReport,
    MedicalEmergency,
    DrowningIncident,
)


def _get_coords_for_report(report):
    if report.latitude is not None and report.longitude is not None:
        return report.latitude, report.longitude

    # Fallback coordinates if none provided
    return 13.9414, 121.6236


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
def create_incident_on_approval(sender, instance: IncidentReport, created, **kwargs):
    # If the report is approved and no Incident exists yet, create one.
    try:
        if str(instance.status).lower() == 'approved':
            existing = Incident.objects.filter(reference_code__iexact=instance.incident_code).first()
            if existing:
                return

            hazard_name = instance.incident_type or 'Medical Emergency'
            if 'fire' in hazard_name.lower():
                hazard_name = 'Fire'
            elif 'rca' in hazard_name.lower() or 'vehicular' in hazard_name.lower() or 'accident' in hazard_name.lower():
                hazard_name = 'Vehicular Accident'
            elif 'crime' in hazard_name.lower():
                hazard_name = 'Crime'
            elif 'drowning' in hazard_name.lower():
                hazard_name = 'Drowning'
            else:
                hazard_name = 'Medical Emergency'

            hazard_type, _ = HazardType.objects.get_or_create(
                name=hazard_name,
                defaults={'description': f'{hazard_name} generated from approved report'},
            )

            lat, lng = _get_coords_for_report(instance)

            now = timezone.localtime()
            occurred_time = instance.time_occurred or now.time()
            incident_datetime = timezone.make_aware(datetime.combine(now.date(), occurred_time))

            severity = _map_severity(instance.incident_type, instance.victim_count)

            # ✅ Prefer the report's barangay if provided; otherwise find nearest
            barangay = instance.barangay if getattr(instance, 'barangay', None) else None
            if barangay is None and lat and lng:
                barangay = get_nearest_barangay(float(lat), float(lng))

            incident = Incident.objects.create(
                reference_code=instance.incident_code,
                hazard_type=hazard_type,
                latitude=Decimal(str(lat)),
                longitude=Decimal(str(lng)),
                address=instance.location or '',
                barangay=barangay,
                reported_by=instance.created_by,
                incident_datetime=incident_datetime,
                severity_level=severity,
                status='verified',
                impact_level='minor' if instance.victim_count > 0 else 'minimal',
                description=instance.description or '',
            )

            lower = (instance.incident_type or '').lower()
            if 'fire' in lower:
                FireDetails.objects.create(
                    incident=incident,
                    cause='Created from approved report',
                    injuries=instance.victim_count,
                )
            elif 'rca' in lower or 'vehicular' in lower or 'accident' in lower:
                VehicularAccident.objects.create(
                    incident=incident,
                    vehicles_involved=1,
                    injuries=instance.victim_count,
                )
            elif 'crime' in lower:
                CrimeReport.objects.create(
                    incident=incident,
                    crime_type=instance.incident_type,
                    victims=instance.victim_count,
                )
            elif 'medical' in lower or 'ambulance' in lower or 'stand-by' in lower:
                MedicalEmergency.objects.create(
                    incident=incident,
                    patient_count=max(instance.victim_count, 1),
                )
            elif 'drowning' in lower:
                DrowningIncident.objects.create(
                    incident=incident,
                    victims=max(instance.victim_count, 1),
                )

    except Exception:
        # Avoid raising during DB hooks; log could be added later
        return

@receiver(post_save, sender=Incident)
def notify_affected_barangay_residents(sender, instance: Incident, created, **kwargs):
    """
    Sends SMS alerts ONLY to verified residents of the affected barangay 
    when a Critical incident is verified. (Advisory B.2)
    """
    # 1. Only trigger for Critical incidents that have an assigned barangay
    if instance.severity_level != 'critical' or not instance.barangay:
        return

    barangay_name = instance.barangay.name
    
    # 2. Find all citizens with VERIFIED residency in this specific barangay
    verified_residents = ResidencyVerification.objects.filter(
        status=ResidencyVerification.STATUS_VERIFIED,
        barangay_name__iexact=barangay_name
    ).select_related('user__account_profile')
    
    if not verified_residents.exists():
        return
        
    # 3. Format the alert message (Advisary B.2.1 & B.2.4: Detailed info + Evacuation awareness)
    location_detail = instance.address if instance.address else "See dashboard map for exact coordinates."
    
    message = (
        f"CRITICAL ALERT: A verified {instance.hazard_type.name} incident has occurred in {barangay_name}. "
        f"Location: {location_detail}. "
        f"Please take immediate precautions. If unsafe, proceed to the nearest evacuation center."
    )
    
    # 4. Loop through and send SMS to those with a valid phone number
    for residency in verified_residents:
        user = residency.user
        try:
            # Fetch phone number from the linked AccountProfile
            phone_number = user.account_profile.phone_number
            
            if phone_number:
                # The sms/utils.py rate-limiter (10/day) protects against spam if this signal fires twice
                send_critical_alert(phone_number, message, incident=instance)
                
        except Exception:
            # Skip users with missing profiles to prevent crashing the signal
            continue