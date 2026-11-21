import json
from io import BytesIO
from decimal import Decimal
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from incidents.models import EarthquakeDetails, Incident


class EarthquakeSyncCommandTests(TestCase):
    def response(self, event_id='us7000test', magnitude=5.2, depth=50):
        payload = {
            'features': [{
                'id': event_id,
                'properties': {
                    'mag': magnitude,
                    'time': int(timezone.now().timestamp() * 1000),
                    'place': '10 km offshore',
                },
                'geometry': {'coordinates': [121.61, 13.94, depth]},
            }],
        }
        return BytesIO(json.dumps(payload).encode('utf-8'))

    @patch('incidents.management.commands.sync_earthquake_events.urlopen')
    def test_sync_creates_unassigned_earthquake_with_null_peis(self, mock_urlopen):
        mock_urlopen.return_value = self.response()

        call_command('sync_earthquake_events')

        details = EarthquakeDetails.objects.get(source_event_id='us7000test')
        self.assertEqual(details.magnitude, Decimal('5.2'))
        self.assertEqual(details.depth, Decimal('50.00'))
        self.assertIsNone(details.intensity)
        self.assertIsNone(details.incident.barangay)
        self.assertEqual(details.incident.severity_level, 'moderate')

    @patch('incidents.management.commands.sync_earthquake_events.urlopen')
    def test_sync_updates_existing_event_instead_of_duplicating(self, mock_urlopen):
        mock_urlopen.side_effect = [
            self.response(),
            self.response(magnitude=3.1, depth=350),
        ]

        call_command('sync_earthquake_events')
        call_command('sync_earthquake_events')

        self.assertEqual(Incident.objects.filter(earthquake_details__source_event_id='us7000test').count(), 1)
        details = EarthquakeDetails.objects.get(source_event_id='us7000test')
        self.assertEqual(details.magnitude, Decimal('3.1'))
        self.assertEqual(details.depth, Decimal('350.00'))
        self.assertEqual(details.incident.severity_level, 'low')

    @patch('incidents.management.commands.sync_earthquake_events.urlopen')
    def test_usgs_query_uses_documented_lucena_bounds(self, mock_urlopen):
        mock_urlopen.return_value = self.response()

        call_command('sync_earthquake_events')

        query = parse_qs(urlparse(mock_urlopen.call_args.args[0].full_url).query)
        self.assertEqual(query['minlatitude'], ['13.89'])
        self.assertEqual(query['maxlatitude'], ['13.98'])
        self.assertEqual(query['minlongitude'], ['121.57'])
        self.assertEqual(query['maxlongitude'], ['121.69'])
