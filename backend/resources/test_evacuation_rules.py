"""
Tests for resources/evacuation.py. They do not need a database:

    python manage.py test resources.test_evacuation_rules
"""

from unittest import TestCase

from resources.evacuation import (
    available_slots,
    distance_km,
    is_accepting_evacuees,
    normalize_status,
    occupancy_rate,
    pick_nearby,
    resolve_status,
)


class ResolveStatusTests(TestCase):
    def test_becomes_full_when_occupancy_reaches_capacity(self):
        self.assertEqual(resolve_status(100, 100, 'available'), 'full')
        self.assertEqual(resolve_status(100, 120, 'available'), 'full')

    def test_becomes_available_again_when_people_leave(self):
        self.assertEqual(resolve_status(100, 99, 'full'), 'available')

    def test_closed_and_maintenance_are_never_changed(self):
        self.assertEqual(resolve_status(100, 0, 'closed'), 'closed')
        self.assertEqual(resolve_status(100, 100, 'maintenance'), 'maintenance')

    def test_status_kept_when_capacity_not_set(self):
        self.assertEqual(resolve_status(0, 0, 'full'), 'full')
        self.assertEqual(resolve_status(0, 5, 'available'), 'available')
        self.assertEqual(resolve_status(0, 0, None), 'available')


class NumbersTests(TestCase):
    def test_available_slots(self):
        self.assertEqual(available_slots(100, 40), 60)
        self.assertEqual(available_slots(100, 150), 0)
        self.assertIsNone(available_slots(0, 10))

    def test_occupancy_rate(self):
        self.assertEqual(occupancy_rate(200, 50), 25.0)
        self.assertEqual(occupancy_rate(10, 20), 100.0)
        self.assertIsNone(occupancy_rate(0, 0))

    def test_only_available_accepts_evacuees(self):
        self.assertTrue(is_accepting_evacuees('available'))
        for status in ('full', 'closed', 'maintenance'):
            self.assertFalse(is_accepting_evacuees(status))

    def test_normalize_status_labels(self):
        self.assertEqual(normalize_status('Under Maintenance'), 'maintenance')
        self.assertEqual(normalize_status(' FULL '), 'full')
        self.assertIsNone(normalize_status('flooded'))

    def test_distance_km(self):
        # Lucena City Hall area to Gulang-Gulang is roughly 3 km.
        self.assertAlmostEqual(distance_km(13.9414, 121.6236, 13.9643, 121.6096), 2.95, delta=0.2)
        self.assertEqual(distance_km(13.94, 121.62, 13.94, 121.62), 0)


class PickNearbyTests(TestCase):
    @staticmethod
    def ranked(*specs):
        # specs: (name, distance, accepting), returned sorted by distance like the view does
        return sorted([(name, dist, ok) for name, dist, ok in specs], key=lambda item: item[1])

    def test_returns_five_closest_accepting_centers(self):
        ranked = self.ranked(
            ('A', 0.5, True), ('B', 0.8, False), ('C', 1.0, True), ('D', 1.2, True),
            ('E', 1.5, True), ('F', 2.0, True), ('G', 3.0, True), ('H', 0.3, False),
        )
        recommended, not_accepting = pick_nearby(ranked, 5)

        self.assertEqual([item[0] for item in recommended], ['A', 'C', 'D', 'E', 'F'])
        self.assertEqual([item[0] for item in not_accepting], ['H', 'B'])

    def test_fills_up_to_limit_when_few_centers_accept(self):
        ranked = self.ranked(('A', 1.0, True), ('B', 0.5, False), ('C', 2.0, False), ('D', 3.0, False))
        recommended, not_accepting = pick_nearby(ranked, 3)

        self.assertEqual([item[0] for item in recommended], ['A', 'B', 'C'])
        self.assertTrue(recommended[0][2], 'accepting center is listed first')
        self.assertEqual([item[0] for item in not_accepting], [])

    def test_fewer_centers_than_limit(self):
        recommended, _ = pick_nearby(self.ranked(('A', 1.0, True), ('B', 2.0, True)), 5)
        self.assertEqual(len(recommended), 2)

    def test_no_centers(self):
        self.assertEqual(pick_nearby([], 5), ([], []))