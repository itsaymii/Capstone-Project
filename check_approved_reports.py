#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, 'backend')
django.setup()

from incidents.models import IncidentReport
from incidents.serializers import IncidentReportSerializer

# Get ALL approved reports
approved_all = IncidentReport.objects.filter(status='Approved')

print(f'Total Approved Reports: {approved_all.count()}')
print()

# Serialize
serializer = IncidentReportSerializer(approved_all, many=True)

# Count by team
teams = {}
for item in serializer.data:
    team = item.get("responderTeam")
    teams[team] = teams.get(team, 0) + 1

print('Reports by Team:')
for team, count in sorted(teams.items()):
    print(f'  - {team}: {count} reports')

