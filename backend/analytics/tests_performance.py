"""
Tests for the team performance analytics.

    python manage.py test analytics.tests_performance
"""
from datetime import datetime, time, timedelta, timezone as dt_timezone
from unittest import TestCase as PlainTestCase

from analytics.performance import build_performance, performance_score, report_minutes, speed_points, summarize

MANILA = dt_timezone(timedelta(hours=8))


def row(team='Alpha', minutes=20.0, resolved=True, severity='moderate', incident_type='RCA', victims=1):
    return {
        'team': team, 'minutes': minutes, 'resolved': resolved, 'severity': severity,
        'incident_type': incident_type, 'victims': victims, 'first_action_minutes': None,
    }


class PerformanceLogicTests(PlainTestCase):
    def test_report_minutes_same_day_and_past_midnight(self):
        filed = datetime(2026, 3, 5, 14, 30, tzinfo=MANILA)
        self.assertEqual(report_minutes(time(14, 0), filed), 30.0)
        just_after_midnight = datetime(2026, 3, 5, 0, 20, tzinfo=MANILA)
        self.assertEqual(report_minutes(time(23, 50), just_after_midnight), 30.0)
        self.assertIsNone(report_minutes(None, filed))

    def test_speed_points_scale(self):
        self.assertEqual(speed_points(10), 100.0)
        self.assertEqual(speed_points(120), 0.0)
        self.assertEqual(speed_points(67.5), 50.0)
        self.assertIsNone(speed_points(None))

    def test_score_uses_resolution_only_without_times(self):
        score, parts = performance_score(None, 0, 80.0)
        self.assertEqual(score, 80.0)
        self.assertIsNone(parts['speed'])

    def test_summary_counts(self):
        summary = summarize([row(minutes=20), row(minutes=50, resolved=False, severity='high'), row(minutes=None)])
        self.assertEqual(summary['assignments'], 3)
        self.assertEqual(summary['measured'], 2)
        self.assertEqual(summary['average_minutes'], 35.0)
        self.assertEqual(summary['on_time'], 1)
        self.assertEqual(summary['on_time_rate'], 50.0)
        self.assertEqual(summary['resolution_rate'], 66.7)
        self.assertEqual(summary['high_priority'], 1)

    def test_faster_team_with_same_resolution_ranks_first(self):
        result = build_performance([
            row(team='Slow', minutes=90), row(team='Slow', minutes=100),
            row(team='Fast', minutes=15), row(team='Fast', minutes=20),
        ])
        self.assertEqual([team['team'] for team in result['teams']], ['Fast', 'Slow'])
        self.assertEqual(result['overall']['assignments'], 4)

    def test_severity_groups_are_in_order(self):
        result = build_performance([row(severity='low'), row(severity='critical'), row(severity=None)])
        self.assertEqual([item['severity'] for item in result['by_severity']], ['critical', 'low', 'unknown'])


try:
    from django.test import TestCase as DjangoTestCase
except ImportError:  # running without Django installed
    DjangoTestCase = None


if DjangoTestCase is not None:
    from django.utils import timezone
    from rest_framework.test import APIClient

    from incidents.models import Incident, IncidentReport
    from locations.models import Barangay

    class PerformanceApiTests(DjangoTestCase):
        def setUp(self):
            self.client = APIClient()
            self.cotta = Barangay.objects.create(name='Cotta')
            self.isabang = Barangay.objects.create(name='Isabang')

        def make_report(self, team, incident_type, filed, minutes_before, barangay, approved=True, details=None):
            report = IncidentReport.objects.create(
                time_occurred=(filed - timedelta(minutes=minutes_before)).time().replace(second=0, microsecond=0),
                incident_type=incident_type,
                responder_team=team,
                location=f'Barangay {barangay.name}, Lucena City',
                barangay=barangay,
                latitude=13.94,
                longitude=121.62,
                description='Test report',
                victim_count=0,
                action_taken='Responded',
                status='Approved' if approved else 'Pending',
                details=details or {},
            )
            IncidentReport.objects.filter(id=report.id).update(created_at=filed)
            return report

        def test_endpoint_returns_team_metrics_and_respects_filters(self):
            now = timezone.localtime().replace(second=0, microsecond=0)
            last_year = now - timedelta(days=400)
            standby = {'event_name': 'Fiesta', 'venue': 'Plaza', 'persons_assisted': 3}
            self.make_report('Alpha', 'Stand-by Medical Team', now, 20, self.cotta, details=standby)
            self.make_report('Alpha', 'Stand-by Medical Team', now, 40, self.cotta, details=standby)
            self.make_report('Bravo', 'Stand-by Medical Team', last_year, 90, self.isabang, details=standby)
            self.make_report('Bravo', 'Stand-by Medical Team', now, 10, self.isabang, approved=False, details=standby)

            # Mark one Alpha incident resolved (incidents are created by the approval signal).
            first_code = IncidentReport.objects.filter(responder_team='Alpha').order_by('created_at').first().incident_code
            Incident.objects.filter(reference_code=first_code).update(status='resolved')

            data = self.client.get('/api/analytics/performance/').json()
            self.assertEqual(data['overall']['assignments'], 3)  # pending report not counted
            alpha = next(team for team in data['teams'] if team['team'] == 'Team Alpha')
            self.assertEqual(alpha['assignments'], 2)
            self.assertEqual(alpha['average_minutes'], 30.0)
            self.assertEqual(alpha['on_time'], 1)
            self.assertEqual(alpha['resolved'], 1)
            self.assertIn('overall_metrics', data)  # old keys kept

            this_year = self.client.get('/api/analytics/performance/', {'year': now.year}).json()
            self.assertEqual(this_year['overall']['assignments'], 2)

            isabang = self.client.get('/api/analytics/performance/', {'barangay': 'Barangay Isabang'}).json()
            self.assertEqual([team['team'] for team in isabang['teams']], ['Team Bravo'])

            bad = self.client.get('/api/analytics/performance/', {'month': '13', 'year': '2026'})
            self.assertEqual(bad.status_code, 400)

        def test_numbered_barangay_filter_does_not_match_barangay_10_or_11(self):
            now = timezone.localtime().replace(second=0, microsecond=0)
            standby = {'event_name': 'Fiesta', 'venue': 'Plaza', 'persons_assisted': 3}
            for team, name in [('One', 'Barangay 1 (Pob.)'), ('Ten', 'Barangay 10 (Pob.)'), ('Eleven', 'Barangay 11 (Pob.)')]:
                self.make_report(team, 'Stand-by Medical Team', now, 20, Barangay.objects.create(name=name), details=standby)

            for value in ('Barangay 1', 'Barangay 1 (Pob.)', '1'):
                data = self.client.get('/api/analytics/performance/', {'barangay': value}).json()
                self.assertEqual([team['team'] for team in data['teams']], ['One'], value)

            cotta = self.client.get('/api/analytics/performance/', {'barangay': 'Cotta'}).json()
            self.assertEqual(cotta['teams'], [])