import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from incidents.serializers import IncidentSerializer
from incidents.models import Incident
from rest_framework.test import APIRequestFactory
from django.contrib.auth.models import User

# Create a test request with authenticated user
factory = APIRequestFactory()
request = factory.get('/api/incidents/?limit=1000')

# Get test user
user = User.objects.filter(is_staff=True).first()
if user:
    request.user = user
else:
    request.user = None

# Fetch incidents
incidents = Incident.objects.all()[:5]
serializer = IncidentSerializer(incidents, many=True, context={'request': request})

print(f"Total incidents in DB: {Incident.objects.count()}")
print(f"First 5 incidents:")
for incident in incidents:
    print(f"  - {incident.id}: {incident.hazard_type.name} at {incident.address}")

print(f"\nSerialized data (first incident):")
if serializer.data:
    print(json.dumps(serializer.data[0], indent=2, default=str))
