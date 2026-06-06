#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, 'backend')
django.setup()

from rest_framework.test import APIRequestFactory
from rest_framework.request import Request
from incidents.views import IncidentReportViewSet
from incidents.serializers import IncidentReportSerializer
from django.contrib.auth.models import User

# Get or create a user
user, _ = User.objects.get_or_create(username='apitest', defaults={'is_staff': True})

# Create a request
factory = APIRequestFactory()
django_request = factory.get('/api/incidents/incident-reports/')
django_request.user = user
request = Request(django_request)

# Get the viewset
viewset = IncidentReportViewSet()
viewset.request = request
viewset.format_kwarg = None

# Get the queryset
queryset = viewset.get_queryset()
print(f'Total reports from viewset: {queryset.count()}')

# Check approved reports
approved = queryset.filter(status='Approved')
print(f'Approved reports count: {approved.count()}')

# Serialize
serializer = IncidentReportSerializer(approved[:1], many=True)
print(f'Serialized approved reports:')
import json
print(json.dumps(serializer.data[0], indent=2, default=str))
