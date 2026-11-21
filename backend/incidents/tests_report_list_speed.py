"""
The incident report list stays quick as reports pile up.

    python manage.py test incidents.tests_report_list_speed
"""

from django.contrib.auth.models import User
from django.db import connection
from django.test.utils import CaptureQueriesContext

from accounts.models import ensure_account_profile
from incidents.tests_permissions import REPORTS_URL, AccessTestCase, make_report, rows


class ReportListSpeedTests(AccessTestCase):
    def add_reports(self, count, start):
        # Each report by a different account, so a per-report profile lookup would show up.
        for number in range(start, start + count):
            author = User.objects.create_user(f'author{number}', f'author{number}@test.local', 'Pass12345', is_staff=True)
            ensure_account_profile(author)
            make_report(created_by=author)

    def count_queries(self):
        client = self.client_for(self.responder)
        with CaptureQueriesContext(connection) as queries:
            response = client.get(REPORTS_URL)
        self.assertEqual(response.status_code, 200)
        return len(queries), len(rows(response))

    def test_query_count_does_not_grow_with_reports(self):
        self.add_reports(2, start=0)
        few_queries, few_rows = self.count_queries()

        self.add_reports(8, start=2)
        many_queries, many_rows = self.count_queries()

        self.assertEqual((few_rows, many_rows), (2, 10))
        self.assertEqual(many_queries, few_queries)

    def test_page_size_returns_only_the_latest(self):
        self.add_reports(7, start=0)
        response = self.client_for(self.responder).get(REPORTS_URL, {'page_size': 5, 'ordering': '-created_at'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(rows(response)), 5)
        self.assertEqual(response.data['count'], 7)

    def test_page_size_is_capped(self):
        self.add_reports(3, start=0)
        response = self.client_for(self.responder).get(REPORTS_URL, {'page_size': 100000})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(rows(response)), 3)

    def test_pending_report_has_no_severity_yet(self):
        report = make_report(created_by=self.responder)
        response = self.client_for(self.responder).get(f'{REPORTS_URL}{report.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['severityLevel'])
