import os
import django
from pathlib import Path
from django.utils import timezone
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent
os.chdir(BASE_DIR)
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

from locations.models import Barangay
from incidents.models import Incident

cutoff = timezone.now() - timedelta(days=90)
print('Barangays with incidents in last 90 days:')
for b in Barangay.objects.all().order_by('name'):
    count = Incident.objects.filter(barangay=b, incident_datetime__gte=cutoff).count()
    if count > 0:
        print(f'{b.name} ({b.id}) - {count}')

print('\nTotal barangays with recent incidents:', sum(1 for b in Barangay.objects.all() if Incident.objects.filter(barangay=b, incident_datetime__gte=cutoff).exists()))
