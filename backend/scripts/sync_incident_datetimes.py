import os
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
    if inc.incident_datetime != report.created_at:
        inc.incident_datetime = report.created_at
        inc.save()
        updated += 1

print(f'Updated incident datetimes: {updated}, Reports without matching Incident: {missing}')
