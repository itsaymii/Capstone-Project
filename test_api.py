#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from incidents.models import Incident
from incidents.serializers import IncidentSerializer

# Get all incidents
incidents = Incident.objects.all()
print(f'Total Incidents: {incidents.count()}')

# Serialize and check
serializer = IncidentSerializer(incidents[:3], many=True)
print('Sample incident data:')
for item in serializer.data:
    print(f'  ID: {item.get("id")}, Code: {item.get("reference_code")}, Status: {item.get("status")}')

# Check if any are empty
if serializer.data:
    print('\nFull first incident data:')
    import json
    print(json.dumps(serializer.data[0], indent=2, default=str))
