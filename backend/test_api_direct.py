import os
import django
import json
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from django.test.client import Client

# Create a test client
client = Client(SERVER_NAME='localhost')

# Login as testresponder
logged_in = client.login(username='testresponder', password='TestResponder@123')
print(f"Login successful: {logged_in}")

# Make a request to the API
response = client.get('/api/incidents/?limit=1000')
print(f"Response status: {response.status_code}")
print(f"Response content type: {response.get('Content-Type')}")

try:
    data = json.loads(response.content)
    print(f"Response data type: {type(data)}")
    print(f"Response full data: {json.dumps(data, indent=2, default=str)[:1000]}")
    
    if isinstance(data, dict):
        print(f"Response keys: {data.keys()}")
        if 'count' in data:
            print(f"Count: {data['count']}")
        if 'results' in data:
            print(f"Results count: {len(data['results'])}")
            if data['results']:
                print(f"First result: {json.dumps(data['results'][0], indent=2, default=str)[:500]}")
    elif isinstance(data, list):
        print(f"Response is list with {len(data)} items")
        if data:
            print(f"First item: {json.dumps(data[0], indent=2, default=str)[:500]}")
except Exception as e:
    print(f"Error parsing response: {e}")
    print(f"Response content: {response.content[:500]}")
