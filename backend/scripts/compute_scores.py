import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from incidents.models import Incident
from analytics.scoring import calculate_risk_score
from locations.models import Barangay
from django.db.models import Count

print('--- Incident counts by barangay ---')
for row in Incident.objects.values('barangay__name').annotate(c=Count('id')).order_by('-c'):
    print(f"{row.get('barangay__name') or 'UNKNOWN'}: {row['c']}")

names = ['Gulang-Gulang', 'Domoit', 'Barangay 1', 'Barangay 9', 'Market View']
print('\n--- Target barangay details ---')
for n in names:
    b = Barangay.objects.filter(name__iexact=n).first()
    if not b:
        print(f"{n}: NOT FOUND")
        continue
    inc_count = Incident.objects.filter(barangay=b).count()
    score_90 = calculate_risk_score(b.id)
    score_long = calculate_risk_score(b.id, days=2000)
    print(f"{n}: incidents={inc_count}, score(90d)={json.dumps(score_90)}, score(2000d)={json.dumps(score_long)}")
