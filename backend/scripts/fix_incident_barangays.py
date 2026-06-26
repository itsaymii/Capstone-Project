import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from incidents.models import Incident, IncidentReport

updated = 0
missing = 0

for report in IncidentReport.objects.filter(status__iexact='Approved'):
    inc = Incident.objects.filter(reference_code__iexact=report.incident_code).first()
    if not inc:
        missing += 1
        continue
    changed = False
    if not inc.barangay and report.barangay:
        inc.barangay = report.barangay
        changed = True
    if (not inc.latitude or not inc.longitude) and (report.latitude and report.longitude):
        try:
            inc.latitude = report.latitude
            inc.longitude = report.longitude
            changed = True
        except Exception:
            pass
    if changed:
        inc.save()
        updated += 1

print(f'Updated incidents: {updated}, Reports without matching Incident: {missing}')
