from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse


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
