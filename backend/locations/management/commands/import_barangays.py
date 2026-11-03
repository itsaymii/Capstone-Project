import json
from django.core.management.base import BaseCommand
from locations.models import Barangay, get_or_create_city_municipality

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
            
            city_name = str(props.get('city_name') or props.get('city') or 'Lucena City').strip()
            province_name = str(props.get('prov_name') or props.get('province') or 'Quezon').strip()
            region_name = str(props.get('reg_name') or 'Region IV-A (CALABARZON)').strip()
            brgy_code = str(props.get('brgy_code') or '').strip()
            city_municipality = get_or_create_city_municipality(
                city_name=city_name,
                province_name=province_name,
                region_name=region_name,
            )

            barangay = None
            if brgy_code:
                barangay = Barangay.objects.filter(brgy_code=brgy_code).first()
            if barangay is None:
                barangay = Barangay.objects.filter(
                    name__iexact=brgy_name.strip(),
                    city_municipality=city_municipality,
                ).first()

            created = barangay is None
            if created:
                barangay = Barangay(
                    name=brgy_name.strip(),
                    city_municipality=city_municipality,
                )
            barangay.name = brgy_name.strip()
            barangay.city_municipality = city_municipality
            barangay.boundary = geom
            barangay.latitude = centroid_lat
            barangay.longitude = centroid_lng
            barangay.brgy_code = brgy_code
            barangay.population = props.get('population', 0)
            barangay.save()
            
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