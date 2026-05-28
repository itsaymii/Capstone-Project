import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from incidents.serializers import IncidentSerializer
from incidents.models import Incident

incident = Incident.objects.first()
if incident:
    serializer = IncidentSerializer(incident)
    print("API Response Data:")
    print(json.dumps(serializer.data, indent=2, default=str))
else:
    print("No incidents found")
