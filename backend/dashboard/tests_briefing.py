from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import AccountProfile
from incidents.models import HazardType, Incident
from locations.models import Barangay, get_or_create_city_municipality

from .briefing import CACHE_KEY, get_strategic_dashboard_briefing
from .models import DashboardInsightCache


class StrategicDashboardBriefingTests(TestCase):
    def setUp(self):
        admin = User.objects.create_user(username='briefing-admin', password='secret123', is_staff=True)
        AccountProfile.objects.update_or_create(
            user=admin,
            defaults={'role': AccountProfile.ROLE_ADMIN},
        )
        self.client.force_login(admin)
        self.now = timezone.now()
        self.hazard = HazardType.objects.create(name='Fire')
        city = get_or_create_city_municipality()
        self.barangay = Barangay.objects.create(name='Barangay 1', city_municipality=city)

    def create_incident(self, reference, incident_datetime, severity, barangay=None):
        return Incident.objects.create(
            reference_code=reference,
            hazard_type=self.hazard,
            latitude=13.94,
            longitude=121.61,
            incident_datetime=incident_datetime,
            severity_level=severity,
            description=reference,
            barangay=barangay,
        )

    def test_briefing_uses_fixed_30_day_window_and_excludes_unassigned_hotspots(self):
        self.create_incident('BRF-RECENT', self.now - timedelta(days=10), 'high', self.barangay)
        self.create_incident('BRF-BOUNDARY', self.now - timedelta(days=30), 'low', self.barangay)
        self.create_incident('BRF-UNASSIGNED', self.now - timedelta(days=5), 'critical')
        self.create_incident('BRF-OLD', self.now - timedelta(days=31), 'critical', self.barangay)

        with patch('dashboard.briefing.timezone.now', return_value=self.now), patch(
            'dashboard.briefing.generate_strategic_dashboard_briefing',
            return_value={
                'headline': 'Test briefing',
                'summary': 'Summary',
                'key_findings': ['Finding one', 'Finding two'],
                'recommended_actions': ['Action one', 'Action two', 'Action three'],
                'source': 'template',
                'source_reason': 'api_key_not_configured',
            },
        ):
            response = self.client.get(reverse('admin-dashboard-strategic-briefing'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['window']['days'], 30)
        self.assertEqual(payload['stats']['total'], 3)
        self.assertEqual(payload['stats']['monthly_average'], 3)
        self.assertEqual(payload['stats']['high_critical_count'], 2)
        self.assertEqual(payload['stats']['high_critical_percentage'], 66.7)
        self.assertEqual(payload['stats']['hotspots'], [{'name': 'Barangay 1', 'count': 2}])

    def test_unauthenticated_user_cannot_generate_briefing(self):
        self.client.logout()

        response = self.client.get(reverse('admin-dashboard-strategic-briefing'))

        self.assertIn(response.status_code, (401, 403))
        self.assertIsNone(DashboardInsightCache.objects.get(key=CACHE_KEY).generated_at)

    def test_non_admin_user_cannot_generate_briefing(self):
        citizen = User.objects.create_user(username='briefing-citizen', password='secret123')
        self.client.force_login(citizen)

        response = self.client.get(reverse('admin-dashboard-strategic-briefing'))

        self.assertEqual(response.status_code, 403)
        self.assertIsNone(DashboardInsightCache.objects.get(key=CACHE_KEY).generated_at)

    def test_cached_briefing_is_reused_before_30_day_expiry(self):
        with patch('dashboard.briefing.timezone.now', return_value=self.now), patch(
            'dashboard.briefing.generate_strategic_dashboard_briefing',
            return_value={'headline': 'Cached', 'source': 'template'},
        ) as generate:
            first = self.client.get(reverse('admin-dashboard-strategic-briefing'))
            second = self.client.get(reverse('admin-dashboard-strategic-briefing'))

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json(), second.json())
        generate.assert_called_once()

    def test_cache_regenerates_at_30_day_expiry(self):
        generated_at = self.now - timedelta(days=30)
        DashboardInsightCache.objects.update_or_create(
            key=CACHE_KEY,
            defaults={
                'window_start': generated_at - timedelta(days=30),
                'window_end': generated_at,
                'generated_at': generated_at,
                'stats': {'total': 999},
                'briefing': {'headline': 'Expired'},
            },
        )

        with patch('dashboard.briefing.timezone.now', return_value=self.now), patch(
            'dashboard.briefing.generate_strategic_dashboard_briefing',
            return_value={'headline': 'Fresh', 'source': 'template'},
        ) as generate:
            response = self.client.get(reverse('admin-dashboard-strategic-briefing'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['briefing']['headline'], 'Fresh')
        self.assertEqual(response.json()['stats']['total'], 0)
        generate.assert_called_once()

    def test_active_refresh_lease_prevents_duplicate_generation(self):
        stale_generated_at = self.now - timedelta(days=31)
        DashboardInsightCache.objects.filter(key=CACHE_KEY).update(
            generated_at=stale_generated_at,
            refresh_started_at=self.now,
            stats={'total': 999},
            briefing={'headline': 'Expired'},
        )

        with patch('dashboard.briefing.timezone.now', return_value=self.now), patch(
            'dashboard.briefing.generate_strategic_dashboard_briefing',
        ) as generate:
            response = self.client.get(reverse('admin-dashboard-strategic-briefing'))

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response['Retry-After'], '2')
        generate.assert_not_called()

    def test_failed_refresh_releases_its_lease(self):
        with patch('dashboard.briefing.timezone.now', return_value=self.now), patch(
            'dashboard.briefing.generate_strategic_dashboard_briefing',
            side_effect=RuntimeError('test generation failure'),
        ):
            with self.assertRaises(RuntimeError):
                get_strategic_dashboard_briefing()

        cache_row = DashboardInsightCache.objects.get(key=CACHE_KEY)
        self.assertIsNone(cache_row.refresh_started_at)

    def test_endpoint_is_throttled_per_user(self):
        cache.clear()
        self.addCleanup(cache.clear)

        with patch(
            'dashboard.views.StrategicBriefingThrottle.THROTTLE_RATES',
            {'strategic_briefing': '1/min'},
        ), patch(
            'dashboard.briefing.generate_strategic_dashboard_briefing',
            return_value={'headline': 'Test', 'source': 'template'},
        ) as generate:
            first = self.client.get(reverse('admin-dashboard-strategic-briefing'))
            second = self.client.get(reverse('admin-dashboard-strategic-briefing'))

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        generate.assert_called_once()
