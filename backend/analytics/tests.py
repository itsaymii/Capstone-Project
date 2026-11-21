from datetime import datetime
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from analytics.scoring import calculate_risk_score
from analytics.insights import generate_strategic_dashboard_briefing
from incidents.models import EarthquakeDetails, HazardType, Incident
from locations.models import Barangay, get_or_create_city_municipality


class StrategicBriefingGenerationTests(TestCase):
    stats = {
        'total': 1,
        'monthly_average': 1,
        'high_critical_count': 1,
        'high_critical_percentage': 100,
        'by_severity': {'low': 0, 'moderate': 0, 'high': 0, 'critical': 1},
        'hotspots': [{'name': 'Barangay 1', 'count': 1}],
    }

    @override_settings(GEMINI_API_KEY='')
    def test_template_fallback_accounts_for_high_severity_even_at_low_volume(self):
        briefing = generate_strategic_dashboard_briefing(self.stats)

        self.assertEqual(briefing['source'], 'template')
        self.assertEqual(briefing['source_reason'], 'api_key_not_configured')
        self.assertIn('High or Critical', briefing['key_findings'][1])
        self.assertIn('high-severity incidents', briefing['recommended_actions'][1])

    @override_settings(GEMINI_API_KEY='test-key')
    @patch('analytics.insights.genai')
    def test_invalid_gemini_json_uses_explicit_template_fallback(self, genai_mock):
        genai_mock.Client.return_value.models.generate_content.return_value.text = '{not json'

        briefing = generate_strategic_dashboard_briefing(self.stats)

        self.assertEqual(briefing['source'], 'template')
        self.assertEqual(briefing['source_reason'], 'generation_failed')
        self.assertEqual(len(briefing['recommended_actions']), 3)

    @override_settings(GEMINI_API_KEY='test-key')
    @patch('analytics.insights.genai')
    def test_gemini_response_must_match_expected_structure(self, genai_mock):
        genai_mock.Client.return_value.models.generate_content.return_value.text = (
            '{"headline":"Briefing","summary":"A summary.","key_findings":["one"],'
            '"recommended_actions":["one","two","three"]}'
        )

        briefing = generate_strategic_dashboard_briefing(self.stats)

        self.assertEqual(briefing['source'], 'template')
        self.assertEqual(briefing['source_reason'], 'generation_failed')

    @override_settings(GEMINI_API_KEY='test-key')
    @patch('analytics.insights.genai')
    def test_valid_gemini_response_is_returned_as_ai_generated(self, genai_mock):
        genai_mock.Client.return_value.models.generate_content.return_value.text = (
            '{"headline":"Strategic incident briefing","summary":"A concise summary.",'
            '"key_findings":["Finding one","Finding two"],'
            '"recommended_actions":["Action one","Action two","Action three"]}'
        )

        briefing = generate_strategic_dashboard_briefing(self.stats)

        self.assertEqual(briefing['source'], 'gemini')
        self.assertEqual(len(briefing['key_findings']), 2)
        self.assertEqual(len(briefing['recommended_actions']), 3)


class CitywideEarthquakeRiskTests(TestCase):
    def test_citywide_score_includes_only_earthquakes_inside_lucena_bounds(self):
        earthquake_type = HazardType.objects.create(name='Earthquake')
        earthquake = Incident.objects.create(
            hazard_type=earthquake_type,
            latitude=13.94,
            longitude=121.61,
            incident_datetime=timezone.now(),
            severity_level='moderate',
            description='USGS event',
        )
        EarthquakeDetails.objects.create(
            incident=earthquake,
            magnitude=5.0,
            depth=50,
            intensity=None,
            source_event_id='citywide-test-event',
        )
        distant_earthquake = Incident.objects.create(
            hazard_type=earthquake_type,
            latitude=14.5,
            longitude=122.5,
            incident_datetime=timezone.now(),
            severity_level='critical',
            description='Distant Philippine event',
        )
        EarthquakeDetails.objects.create(
            incident=distant_earthquake,
            magnitude=6.0,
            depth=20,
            intensity=None,
            source_event_id='distant-test-event',
        )
        fire_type = HazardType.objects.create(name='Fire')
        Incident.objects.create(
            hazard_type=fire_type,
            latitude=13.94,
            longitude=121.61,
            incident_datetime=timezone.now(),
            severity_level='critical',
            description='Not an earthquake',
        )

        response = APIClient().get('/api/analytics/citywide-earthquake-risk/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['risk_score']['explanation']['total_incidents'], 1)
        self.assertEqual(response.data['timeframe_days'], 90)
        # Newest stored event (any area) and newest inside Lucena, for the page's freshness note.
        self.assertIsNotNone(response.data['latest_feed_event_at'])
        self.assertEqual(response.data['latest_lucena_event_at'], earthquake.incident_datetime.isoformat())

    def test_citywide_score_reports_no_events(self):
        response = APIClient().get('/api/analytics/citywide-earthquake-risk/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['risk_score']['explanation']['total_incidents'], 0)
        self.assertIsNone(response.data['latest_feed_event_at'])
        self.assertIsNone(response.data['latest_lucena_event_at'])

    def test_citywide_score_rejects_nonpositive_window(self):
        response = APIClient().get('/api/analytics/citywide-earthquake-risk/', {'days': 0})

        self.assertEqual(response.status_code, 400)


class HistoricalRiskScoreTests(TestCase):
    def test_historical_recency_is_relative_to_period_and_excludes_false_alarms(self):
        barangay = Barangay.objects.create(
            name='Risk Test Barangay',
            city_municipality=get_or_create_city_municipality(),
        )
        hazard = HazardType.objects.create(name='Fire')
        period_start = timezone.make_aware(datetime(2020, 1, 1))
        period_end = timezone.make_aware(datetime(2020, 1, 31, 23, 59, 59))

        Incident.objects.create(
            hazard_type=hazard,
            latitude=13.94,
            longitude=121.61,
            barangay=barangay,
            incident_datetime=timezone.make_aware(datetime(2020, 1, 15)),
            severity_level='high',
            status='verified',
            description='Verified historical incident',
        )
        Incident.objects.create(
            hazard_type=hazard,
            latitude=13.94,
            longitude=121.61,
            barangay=barangay,
            incident_datetime=timezone.make_aware(datetime(2020, 1, 20)),
            severity_level='critical',
            status='false_alarm',
            description='False alarm',
        )

        result = calculate_risk_score(
            barangay.id,
            start_date=period_start,
            end_date=period_end,
        )

        self.assertEqual(result['explanation']['total_incidents'], 1)
        self.assertEqual(result['explanation']['recent_incidents_30_days'], 1)
        self.assertEqual(result['breakdown']['recency'], 10.0)
