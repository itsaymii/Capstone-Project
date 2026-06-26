import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory
from incidents.views import IncidentViewSet

# Create a test request with staff user
factory = APIRequestFactory()
request = factory.get('/api/incidents/?limit=1000')

# Get test staff user
user = User.objects.filter(is_staff=True, username='testresponder').first()
if user:
    request.user = user
    print(f"Using user: {user.username}, is_staff: {user.is_staff}")
else:
    print("Test responder user not found!")
    user = User.objects.filter(is_staff=True).first()
    if user:
        request.user = user
        print(f"Using fallback user: {user.username}")

# Create the view and set request
viewset = IncidentViewSet()
viewset.request = request
viewset.format_kwarg = None

# Get the queryset
try:
    queryset = viewset.get_queryset()
    print(f"Queryset count: {queryset.count()}")
    print(f"Queryset query: {queryset.query}")
    
    # Check filtering
    from rest_framework_filters.backends import DjangoFilterBackend
    filter_backend = DjangoFilterBackend()
    filtered_qs = filter_backend.filter_queryset(request, queryset, viewset)
    print(f"Filtered queryset count: {filtered_qs.count()}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
