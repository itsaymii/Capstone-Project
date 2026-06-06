from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import datetime
from decimal import Decimal

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

            incident = Incident.objects.create(
                reference_code=instance.incident_code,
                hazard_type=hazard_type,
                latitude=Decimal(str(lat)),
                longitude=Decimal(str(lng)),
                address=instance.location or '',
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
