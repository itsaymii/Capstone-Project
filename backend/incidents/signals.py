from django.db.models.signals import post_save
from django.apps import apps
from django.db import connections
from django.db.models.signals import post_migrate
from .utils import get_nearest_barangay
from .incident_types import detail_table_values, fit_detail_values
from .severity import score_report_severity
from django.dispatch import receiver
from django.utils import timezone
from django.utils.dateparse import parse_time
from datetime import datetime, timedelta
from decimal import Decimal
from sms.utils import send_critical_alert
from accounts.models import ResidencyVerification

from .models import (
    IncidentReport,
    DEFAULT_RESPONDER_TEAMS,
    Incident,
    HazardType,
    FireDetails,
    VehicularAccident,
    CrimeReport,
    MedicalEmergency,
    DrowningIncident,
)


@receiver(post_migrate, dispatch_uid='incidents.ensure_default_responder_teams')
def ensure_default_responder_teams(sender, using, **kwargs):
    if sender.name != 'incidents':
        return

    ResponderTeam = apps.get_model('incidents', 'ResponderTeam')
    if ResponderTeam._meta.db_table not in connections[using].introspection.table_names():
        return
    for code, name in DEFAULT_RESPONDER_TEAMS:
        ResponderTeam.objects.using(using).get_or_create(
            code=code,
            defaults={'name': name},
        )


def _get_coords_for_report(report):
    if report.latitude is not None and report.longitude is not None:
        return report.latitude, report.longitude

    # Fallback coordinates if none provided
    return 13.9414, 121.6236


def _fallback_detail_table(report):
    """Detail table for report types not listed in incident_types.py (same behaviour as before)."""
    lower = (report.incident_type or '').lower()
    if 'fire' in lower:
        return 'fire', {'cause': 'Created from approved report', 'injuries': report.victim_count}
    if 'rca' in lower or 'vehicular' in lower or 'accident' in lower:
        return 'vehicular', {'vehicles_involved': 1, 'injuries': report.victim_count}
    if 'crime' in lower:
        return 'crime', {'crime_type': report.incident_type, 'victims': report.victim_count}
    if 'medical' in lower or 'ambulance' in lower or 'stand-by' in lower:
        return 'medical', {'patient_count': max(report.victim_count, 1)}
    if 'drowning' in lower:
        return 'drowning', {'victims': max(report.victim_count, 1)}
    return None, {}


@receiver(post_save, sender=IncidentReport)
def create_incident_on_approval(sender, instance: IncidentReport, created, **kwargs):
    # If the report is approved and no Incident exists yet, create one.
    if str(instance.status).lower() == 'approved':
        existing = Incident.objects.filter(reference_code__iexact=instance.incident_code).first()
        if existing:
            if instance.incident_id != existing.pk:
                IncidentReport.objects.filter(pk=instance.pk).update(incident=existing)
                instance.incident = existing
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

        filed_at = timezone.localtime(instance.created_at or timezone.now())
        occurred_time = instance.time_occurred or filed_at.time()
        if isinstance(occurred_time, str):
            occurred_time = parse_time(occurred_time)
            if occurred_time is None:
                raise ValueError(f'Invalid time_occurred value for report {instance.pk}.')
        occurred_date = filed_at.date()
        if occurred_time > filed_at.time():
            occurred_date -= timedelta(days=1)
        incident_datetime = timezone.make_aware(datetime.combine(occurred_date, occurred_time))

        severity = score_report_severity(
            instance.incident_type,
            instance.details,
            [victim.details for victim in instance.victims.all()],
            instance.victim_count,
        )

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
        IncidentReport.objects.filter(pk=instance.pk).update(incident=incident)
        instance.incident = incident

        table, values = detail_table_values(
            instance.incident_type,
            getattr(instance, 'details', None) or {},
            instance.victim_count,
        )
        if table is None:
            table, values = _fallback_detail_table(instance)

        detail_models = {
            'fire': FireDetails,
            'vehicular': VehicularAccident,
            'crime': CrimeReport,
            'medical': MedicalEmergency,
            'drowning': DrowningIncident,
        }
        if table in detail_models:
            detail_models[table].objects.create(incident=incident, **fit_detail_values(table, values))

@receiver(post_save, sender=Incident)
def notify_affected_barangay_residents(sender, instance: Incident, created, **kwargs):
    """
    Sends SMS alerts ONLY to verified residents of the affected barangay 
    when a Critical incident is verified. (Advisory B.2)
    """
    # 1. Only trigger for Critical incidents that have an assigned barangay
    if instance.severity_level != 'critical' or not instance.barangay:
        return

    barangay = instance.barangay
    barangay_name = barangay.name
    
    # 2. Find all citizens with VERIFIED residency in this specific barangay
    verified_residents = ResidencyVerification.objects.filter(
        status=ResidencyVerification.STATUS_VERIFIED,
        barangay_record_id=barangay.pk,
    ).select_related('user__account_profile', 'barangay_record')
    
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
