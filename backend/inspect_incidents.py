import os
import django
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
os.chdir(BASE_DIR)
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

from django.db.models import Count
from django.utils import timezone
from datetime import timedelta
from locations.models import Barangay
from incidents.models import Incident

print('Top barangays by total incident count')
for b in Barangay.objects.annotate(count=Count('incidents')).order_by('-count')[:20]:
    print(f'{b.name} ({b.id}) - {b.count}')

print('\nTop barangays by incident count in last 90 days')
cutoff = timezone.now() - timedelta(days=90)
for b in Barangay.objects.annotate(count=Count('incidents', filter=Incident.objects.filter(incident_datetime__gte=cutoff))).order_by('-count')[:20]:
    print(f'{b.name} ({b.id}) - {b.count}')
