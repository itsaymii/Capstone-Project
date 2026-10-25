"""
Plain-Python rules for evacuation centers (no Django imports, so they are easy to test).

Status rules
------------
- "closed" and "maintenance" are always set by hand and are never changed automatically.
- When a capacity is set (> 0), "available" and "full" follow the numbers:
  occupancy >= capacity  -> "full", otherwise -> "available".
- When capacity is 0 (not set yet), whatever status the admin chose is kept.

Only "available" centers are recommended as places that can still take evacuees.
"""

from math import asin, cos, radians, sin, sqrt

STATUS_AVAILABLE = 'available'
STATUS_FULL = 'full'
STATUS_CLOSED = 'closed'
STATUS_MAINTENANCE = 'maintenance'

MANUAL_STATUSES = {STATUS_CLOSED, STATUS_MAINTENANCE}
VALID_STATUSES = {STATUS_AVAILABLE, STATUS_FULL, STATUS_CLOSED, STATUS_MAINTENANCE}

# Labels people may type in a CSV file, mapped to the stored value.
STATUS_ALIASES = {
    'available': STATUS_AVAILABLE,
    'open': STATUS_AVAILABLE,
    'full': STATUS_FULL,
    'closed': STATUS_CLOSED,
    'close': STATUS_CLOSED,
    'maintenance': STATUS_MAINTENANCE,
    'under maintenance': STATUS_MAINTENANCE,
    'under_maintenance': STATUS_MAINTENANCE,
}

DEFAULT_NEARBY_LIMIT = 5
MAX_NEARBY_LIMIT = 20


def normalize_status(value):
    """Return the stored status for a label like "Under Maintenance", or None if unknown."""
    return STATUS_ALIASES.get(str(value or '').strip().lower())


def resolve_status(capacity, current_occupancy, requested_status):
    """Return the status a center should have, given its numbers and the status asked for."""
    status = requested_status or STATUS_AVAILABLE

    if status in MANUAL_STATUSES:
        return status

    if capacity and capacity > 0:
        return STATUS_FULL if current_occupancy >= capacity else STATUS_AVAILABLE

    return status


def available_slots(capacity, current_occupancy):
    """Free spaces left, or None when capacity has not been set."""
    if not capacity or capacity <= 0:
        return None
    return max(capacity - current_occupancy, 0)


def occupancy_rate(capacity, current_occupancy):
    """Percent of capacity in use (0-100), or None when capacity has not been set."""
    if not capacity or capacity <= 0:
        return None
    return round(min(current_occupancy / capacity, 1) * 100, 1)


def is_accepting_evacuees(status):
    return status == STATUS_AVAILABLE


def distance_km(lat1, lng1, lat2, lng2):
    """Great-circle (haversine) distance between two points in kilometres."""
    earth_radius_km = 6371
    lat_delta = radians(lat2 - lat1)
    lng_delta = radians(lng2 - lng1)
    value = (
        sin(lat_delta / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(lng_delta / 2) ** 2
    )
    return earth_radius_km * 2 * asin(sqrt(value))


def pick_nearby(ranked, limit):
    """
    Choose which centers to recommend.

    `ranked` is a list of (center, distance_km, accepting) tuples sorted by distance.

    Returns (recommended, not_accepting_nearby):
    - recommended: the `limit` closest centers that accept evacuees. If fewer than `limit`
      accept evacuees, the closest other centers fill the list so the user still sees `limit`.
    - not_accepting_nearby: centers that are closer than the farthest recommended one but are
      Full / Closed / Under Maintenance, so people know about them without being sent there.
    """
    accepting = [item for item in ranked if item[2]]
    others = [item for item in ranked if not item[2]]

    recommended = accepting[:limit]
    if len(recommended) < limit:
        recommended += others[: limit - len(recommended)]
        recommended.sort(key=lambda item: (not item[2], item[1]))

    chosen = {id(item[0]) for item in recommended}
    farthest = max((item[1] for item in recommended), default=0)
    not_accepting_nearby = [
        item for item in others
        if id(item[0]) not in chosen and item[1] <= farthest
    ]

    return recommended, not_accepting_nearby