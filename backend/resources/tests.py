from django.urls import reverse
from rest_framework.test import APITestCase

from .models import EvacuationCenter, Volunteer, VolunteerSkillAssignment
from .serializers import VolunteerSerializer

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


class VolunteerSkillSerializerTests(APITestCase):
    def test_create_keeps_skill_code_list_shape_and_order(self):
        serializer = VolunteerSerializer(data={
            'full_name': 'Sample Volunteer',
            'contact_number': '09123456789',
            'address': 'Sample address',
            'skills': ['rescue', 'medical'],
            'certifications': 'First Aid Certificate',
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        volunteer = serializer.save()

        self.assertEqual(volunteer.skills, ['rescue', 'medical'])
        self.assertEqual(serializer.data['skills'], ['rescue', 'medical'])
        self.assertEqual(
            list(
                VolunteerSkillAssignment.objects.filter(volunteer=volunteer)
                .order_by('position')
                .values_list('position', flat=True)
            ),
            [0, 1],
        )
        self.assertEqual(volunteer.certifications, 'First Aid Certificate')

    def test_update_changes_skills_only_when_field_is_supplied(self):
        volunteer = Volunteer.objects.create(
            full_name='Sample Volunteer',
            contact_number='09123456789',
            address='Sample address',
        )
        volunteer_serializer = VolunteerSerializer(
            volunteer,
            data={'skills': ['logistics']},
            partial=True,
        )
        self.assertTrue(volunteer_serializer.is_valid(), volunteer_serializer.errors)
        volunteer_serializer.save()
        self.assertEqual(volunteer.skills, ['logistics'])

        unchanged_serializer = VolunteerSerializer(
            volunteer,
            data={'status': 'inactive'},
            partial=True,
        )
        self.assertTrue(unchanged_serializer.is_valid(), unchanged_serializer.errors)
        unchanged_serializer.save()
        self.assertEqual(volunteer.skills, ['logistics'])

        clear_serializer = VolunteerSerializer(
            volunteer,
            data={'skills': []},
            partial=True,
        )
        self.assertTrue(clear_serializer.is_valid(), clear_serializer.errors)
        clear_serializer.save()
        self.assertEqual(volunteer.skills, [])
