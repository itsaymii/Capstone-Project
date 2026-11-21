import json
from datetime import datetime, timedelta, timezone as datetime_timezone
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from locations.constants import (
    LUCENA_CITY_MAX_LATITUDE,
    LUCENA_CITY_MAX_LONGITUDE,
    LUCENA_CITY_MIN_LATITUDE,
    LUCENA_CITY_MIN_LONGITUDE,
)
from incidents.models import EarthquakeDetails, HazardType, Incident
from incidents.severity import score_earthquake


USGS_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query'


class Command(BaseCommand):
    help = 'Imports recent USGS earthquake events for city-wide risk analytics.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Number of days to sync (default: 30).',
        )

    def handle(self, *args, **options):
        days = options['days']
        if days < 1:
            raise CommandError('--days must be at least 1.')

        payload = self._fetch_events(days)
        if not isinstance(payload, dict):
            raise CommandError('USGS response must be a GeoJSON object.')
        features = payload.get('features')
        if not isinstance(features, list):
            raise CommandError('USGS response did not contain an event list.')

        earthquake_type, _ = HazardType.objects.get_or_create(
            name='Earthquake',
            defaults={'description': 'Earthquake events imported from the USGS catalog.'},
        )
        created = 0
        updated = 0

        for feature in features:
            event = self._parse_event(feature)
            severity = score_earthquake(event['magnitude'], event['depth'])
            with transaction.atomic():
                details = (
                    EarthquakeDetails.objects.select_for_update()
                    .select_related('incident')
                    .filter(source_event_id=event['event_id'])
                    .first()
                )
                if details:
                    incident = details.incident
                    incident.hazard_type = earthquake_type
                    incident.latitude = event['latitude']
                    incident.longitude = event['longitude']
                    incident.address = event['place']
                    incident.incident_datetime = event['incident_datetime']
                    incident.severity_level = severity['severity']
                    incident.description = event['description']
                    incident.status = 'verified'
                    incident.impact_level = 'minimal'
                    incident.save(update_fields=[
                        'hazard_type', 'latitude', 'longitude', 'address',
                        'incident_datetime', 'severity_level', 'description',
                        'status', 'impact_level', 'updated_at',
                    ])
                    details.magnitude = event['magnitude']
                    details.depth = event['depth']
                    details.intensity = None
                    details.save(update_fields=['magnitude', 'depth', 'intensity', 'updated_at'])
                    updated += 1
                else:
                    incident = Incident.objects.create(
                        hazard_type=earthquake_type,
                        latitude=event['latitude'],
                        longitude=event['longitude'],
                        address=event['place'],
                        reported_by=None,
                        incident_datetime=event['incident_datetime'],
                        severity_level=severity['severity'],
                        status='verified',
                        impact_level='minimal',
                        description=event['description'],
                    )
                    EarthquakeDetails.objects.create(
                        incident=incident,
                        magnitude=event['magnitude'],
                        depth=event['depth'],
                        intensity=None,
                        source_event_id=event['event_id'],
                    )
                    created += 1

        self.stdout.write(self.style.SUCCESS(
            f'Synced {len(features)} USGS earthquake event(s): {created} created, {updated} updated.'
        ))

    def _fetch_events(self, days):
        end_time = timezone.now().astimezone(datetime_timezone.utc)
        start_time = end_time - timedelta(days=days)
        params = {
            'format': 'geojson',
            'starttime': start_time.isoformat(),
            'endtime': end_time.isoformat(),
            'minlatitude': str(LUCENA_CITY_MIN_LATITUDE),
            'maxlatitude': str(LUCENA_CITY_MAX_LATITUDE),
            'minlongitude': str(LUCENA_CITY_MIN_LONGITUDE),
            'maxlongitude': str(LUCENA_CITY_MAX_LONGITUDE),
            'minmagnitude': '1.0',
            'orderby': 'time',
            'limit': '20000',
        }
        request = Request(
            f'{USGS_QUERY_URL}?{urlencode(params)}',
            headers={'User-Agent': 'Capstone-Project earthquake analytics'},
        )
        try:
            with urlopen(request, timeout=30) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise CommandError(f'Could not fetch USGS earthquake events: {exc}') from exc

    def _parse_event(self, feature):
        if not isinstance(feature, dict):
            raise CommandError('USGS response contains a malformed event.')
        properties = feature.get('properties')
        geometry = feature.get('geometry')
        coordinates = geometry.get('coordinates') if isinstance(geometry, dict) else None
        event_id = feature.get('id')
        if (
            not isinstance(properties, dict)
            or not isinstance(coordinates, list)
            or len(coordinates) < 3
            or not event_id
        ):
            raise CommandError(f'USGS event {event_id or "(unknown)"} is missing required fields.')

        try:
            magnitude = Decimal(str(properties.get('mag') or 0)).quantize(Decimal('0.1'))
            longitude = Decimal(str(coordinates[0])).quantize(Decimal('0.000001'))
            latitude = Decimal(str(coordinates[1])).quantize(Decimal('0.000001'))
            depth = Decimal(str(coordinates[2])).quantize(Decimal('0.01'))
            occurred_at = datetime.fromtimestamp(
                float(properties['time']) / 1000,
                tz=datetime_timezone.utc,
            )
        except (KeyError, TypeError, ValueError, InvalidOperation, OverflowError) as exc:
            raise CommandError(f'USGS event {event_id} contains invalid measurements or time.') from exc

        place = properties.get('place') or 'Near the Philippines'
        return {
            'event_id': str(event_id),
            'magnitude': magnitude,
            'depth': depth,
            'latitude': latitude,
            'longitude': longitude,
            'incident_datetime': occurred_at,
            'place': str(place),
            'description': f'USGS earthquake event {event_id}: M{magnitude} at {place}.',
        }
