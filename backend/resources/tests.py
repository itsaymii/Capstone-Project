from django.urls import reverse
from rest_framework.test import APITestCase

from .models import EvacuationCenter

class EvacuationCenterApiTests(APITestCase):
	def setUp(self):
		EvacuationCenter.objects.create(
			name='Near Center',
			latitude=13.940000,
			longitude=121.620000,
			address='Near address',
			capacity=100,
			current_occupancy=25,
		)
		EvacuationCenter.objects.create(
			name='Far Center',
			latitude=13.980000,
			longitude=121.680000,
			address='Far address',
		)

	def test_nearest_center_uses_approximate_coordinates(self):
		response = self.client.get(
			reverse('evacuation-center-nearest'),
			{'latitude': '13.941', 'longitude': '121.621'},
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['name'], 'Near Center')
		self.assertGreater(response.data['distance_km'], 0)
		self.assertEqual(response.data['capacity'], 100)
		self.assertEqual(response.data['current_occupancy'], 25)
		self.assertEqual(response.data['status'], 'available')

	def test_nearest_center_rejects_invalid_coordinates(self):
		response = self.client.get(
			reverse('evacuation-center-nearest'),
			{'latitude': 'not-a-number', 'longitude': '121.621'},
		)

		self.assertEqual(response.status_code, 400)
