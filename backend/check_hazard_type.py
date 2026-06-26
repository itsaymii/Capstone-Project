import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from incidents.models import Incident

incident = Incident.objects.first()
if incident:
    print(f"ID: {incident.id}")
    print(f"Hazard Type: {incident.hazard_type}")
    print(f"Hazard Type Type: {type(incident.hazard_type)}")
    if hasattr(incident.hazard_type, 'name'):
        print(f"Hazard Type Name: {incident.hazard_type.name}")
    else:
        print("No name attribute")
else:
    print("No incidents found")
