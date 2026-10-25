from django.db.models.signals import post_save
from .utils import get_nearest_barangay
from .incident_types import detail_table_values, fit_detail_values
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

            # Copy the report's type-specific details into the matching detail table.
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

    except Exception:
        # Avoid raising during DB hooks; log could be added later
        return