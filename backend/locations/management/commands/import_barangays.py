import json
from django.core.management.base import BaseCommand
from locations.models import Barangay

# This command imports barangays from a GeoJSON file. It can be run with:
# python manage.py import_barangays path/to/barangays.geojson
class Command(BaseCommand):
    help = 'Import barangays from GeoJSON file'

    def add_arguments(self, parser):
        parser.add_argument(
            'geojson_file',
            type=str,
            help='Path to GeoJSON file'
        )

    def handle(self, *args, **options):
        geojson_path = options['geojson_file']
        
        try:
            with open(geojson_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            self.stdout.write(
                self.style.ERROR(f'File not found: {geojson_path}')
            )
            return
        
        if data.get('type') != 'FeatureCollection':
            self.stdout.write(
                self.style.ERROR('Invalid GeoJSON: Must be FeatureCollection')
            )
            return
        
        count = 0
        updated = 0
        
        for feature in data['features']:
            props = feature.get('properties', {})
            geom = feature.get('geometry')
            
            # Get barangay name from various possible property names
            brgy_name = (
                props.get('brgy_name') or 
                props.get('barangay_name') or 
                props.get('name') or
                ''
            )
            
            if not brgy_name:
                continue
            
            # Calculate centroid from geometry
            centroid_lat, centroid_lng = self._calculate_centroid(geom)
            
            barangay, created = Barangay.objects.update_or_create(
                name=brgy_name,
                defaults={
                    'city': props.get('city_name', props.get('city', 'Lucena City')),
                    'province': props.get('prov_name', props.get('province', 'Quezon')),
                    'boundary': geom,
                    'latitude': centroid_lat,
                    'longitude': centroid_lng,
                    'brgy_code': props.get('brgy_code', ''),
                    'reg_name': props.get('reg_name', ''),
                    'population': props.get('population', 0),
                }
            )
            
            if created:
                count += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created: {barangay}'))
            else:
                updated += 1
                self.stdout.write(self.style.WARNING(f'↻ Updated: {barangay}'))
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Import Complete!\n'
                f'   Created: {count}\n'
                f'   Updated: {updated}\n'
                f'   Total: {count + updated}'
            )
        )
    
    def _calculate_centroid(self, geom):
        """Calculate centroid from GeoJSON geometry"""
        if not geom or geom.get('type') not in ['Polygon', 'MultiPolygon']:
            return None, None
        
        coords = geom['coordinates']
        
        # For Polygon, get first ring
        if geom['type'] == 'Polygon':
            ring = coords[0]
        else:  # MultiPolygon
            ring = coords[0][0]
        
        # Calculate average of all points
        if ring:
            avg_lng = sum(point[0] for point in ring) / len(ring)
            avg_lat = sum(point[1] for point in ring) / len(ring)
            return avg_lat, avg_lng
        
        return None, None