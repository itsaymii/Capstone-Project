import io
import json
import os
import tempfile

from django.core.management import call_command
from django.test import TestCase

from .models import Barangay, CityMunicipality, Province, Region
from .serializers import BarangaySerializer


class BarangayHierarchyTests(TestCase):
    def test_barangays_share_normalized_geographic_records(self):
        first = Barangay.objects.create(name='Cotta')
        second = Barangay.objects.create(name='Isabang')

        self.assertEqual(first.city_municipality_id, second.city_municipality_id)
        self.assertEqual(first.city, 'Lucena City')
        self.assertEqual(first.province, 'Quezon')
        self.assertEqual(first.reg_name, 'Region IV-A (CALABARZON)')
        self.assertEqual(Region.objects.count(), 1)
        self.assertEqual(Province.objects.count(), 1)
        self.assertEqual(CityMunicipality.objects.count(), 1)

    def test_barangay_serializer_preserves_legacy_geography_fields(self):
        serializer = BarangaySerializer(data={
            'name': 'Cotta',
            'city': 'Lucena City',
            'province': 'Quezon',
            'reg_name': 'Region IV-A (CALABARZON)',
            'brgy_code': '045624001',
            'population': 100,
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        barangay = serializer.save()
        response_data = BarangaySerializer(barangay).data

        self.assertEqual(response_data['city'], 'Lucena City')
        self.assertEqual(response_data['province'], 'Quezon')
        self.assertEqual(response_data['reg_name'], 'Region IV-A (CALABARZON)')
        self.assertEqual(response_data['brgy_code'], '045624001')

    def test_import_uses_official_code_as_stable_barangay_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            geojson_path = os.path.join(directory, 'barangays.geojson')

            def write_feature(name, code, city='Lucena City'):
                data = {
                    'type': 'FeatureCollection',
                    'features': [{
                        'type': 'Feature',
                        'properties': {
                            'brgy_name': name,
                            'brgy_code': code,
                            'city_name': city,
                            'prov_name': 'Quezon',
                            'reg_name': 'Region IV-A (CALABARZON)',
                        },
                        'geometry': {
                            'type': 'Polygon',
                            'coordinates': [[[121.6, 13.9], [121.7, 13.9], [121.7, 14.0], [121.6, 13.9]]],
                        },
                    }],
                }
                with open(geojson_path, 'w', encoding='utf-8') as geojson_file:
                    json.dump(data, geojson_file)

            write_feature('Cotta', '045624001')
            call_command('import_barangays', geojson_path, stdout=io.StringIO())
            write_feature('Cotta Updated', '045624001')
            call_command('import_barangays', geojson_path, stdout=io.StringIO())
            write_feature('Cotta Updated', '045624002', city='Tayabas City')
            call_command('import_barangays', geojson_path, stdout=io.StringIO())

        self.assertEqual(Barangay.objects.filter(brgy_code='045624001').count(), 1)
        self.assertEqual(Barangay.objects.get(brgy_code='045624001').name, 'Cotta Updated')
        self.assertEqual(Barangay.objects.filter(name='Cotta Updated').count(), 2)
