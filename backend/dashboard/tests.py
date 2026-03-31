from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse

from .models import SimulationProgress


class DashboardViewsTests(TestCase):
    def test_admin_summary_requires_authentication(self):
        response = self.client.get(reverse('admin-dashboard-summary'))

        self.assertIn(response.status_code, [401, 403])

    def test_admin_summary_rejects_non_admin_user(self):
        user = User.objects.create_user(username='regular-user', password='secret123')
        self.client.force_login(user)

        response = self.client.get(reverse('admin-dashboard-summary'))

        self.assertEqual(response.status_code, 403)

    def test_admin_summary_returns_expected_shape(self):
        admin_user = User.objects.create_user(username='admin-user', password='secret123', is_staff=True)
        self.client.force_login(admin_user)

        response = self.client.get(reverse('admin-dashboard-summary'))

        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertIn('summary', payload)

        summary = payload['summary']
        self.assertIn('totalUsers', summary)
        self.assertIn('totalAdminUsers', summary)
        self.assertIn('activeUsersLast30Days', summary)
        self.assertIn('pendingOtps', summary)
        self.assertIn('verifiedOtpsToday', summary)

    def test_simulation_metrics_require_admin_access(self):
        user = User.objects.create_user(username='regular-user', password='secret123')
        self.client.force_login(user)

        response = self.client.get(reverse('admin-simulation-metrics'))

        self.assertEqual(response.status_code, 403)

    def test_simulation_metrics_return_aggregated_course_stats(self):
        admin_user = User.objects.create_user(username='admin-user', password='secret123', is_staff=True)
        user_one = User.objects.create_user(username='learner-one', password='secret123')
        user_two = User.objects.create_user(username='learner-two', password='secret123')
        user_three = User.objects.create_user(username='learner-three', password='secret123')

        SimulationProgress.objects.create(
            user=user_one,
            course_progress={'earthquake': 100, 'fire': 20},
            completed_courses={'earthquake': '2026-03-31T08:00:00+00:00'},
        )
        SimulationProgress.objects.create(
            user=user_two,
            course_progress={'earthquake': 50},
            completed_courses={},
        )
        SimulationProgress.objects.create(
            user=user_three,
            course_progress={'fire': 100},
            completed_courses={'fire': '2026-03-31T09:00:00+00:00'},
        )

        self.client.force_login(admin_user)
        response = self.client.get(reverse('admin-simulation-metrics'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('courses', payload)
        self.assertEqual(payload['courses']['earthquake']['trainees'], 2)
        self.assertEqual(payload['courses']['earthquake']['completed'], 1)
        self.assertEqual(payload['courses']['earthquake']['completionRate'], 50)
        self.assertEqual(payload['courses']['fire']['trainees'], 2)
        self.assertEqual(payload['courses']['fire']['completed'], 1)
        self.assertEqual(payload['courses']['fire']['completionRate'], 50)
