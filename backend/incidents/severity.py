"""Incident-type-specific severity scoring."""

from decimal import Decimal

from .incident_types import get_incident_type

RCA_INJURY_POINTS = {
    'none': 0,
    'minor_first_aid': 10,
    'severe_hospital_transport': 20,
}


def score_road_crash(details, victim_details):
    """Return the weighted RCA points and standard severity label."""
    fatalities = int(details.get('fatalities') or 0)
    vehicles = int(details.get('vehicles_involved') or 1)

    fatality_points = 0 if fatalities == 0 else 20 if fatalities == 1 else 40
    vehicle_points = 0 if vehicles <= 1 else 15 if vehicles == 2 else 30

    injury_levels = [
        victim.get('injury_severity')
        for victim in victim_details
        if victim.get('injury_severity') in RCA_INJURY_POINTS
    ]
    injured_count = sum(level != 'none' for level in injury_levels)
    # Three or more injured people trigger the MCI injury tier regardless of individual grades.
    injury_points = (
        30 if injured_count >= 3
        else max((RCA_INJURY_POINTS[level] for level in injury_levels), default=0)
    )

    total_points = fatality_points + vehicle_points + injury_points
    if total_points <= 25:
        severity = 'low'
    elif total_points <= 50:
        severity = 'moderate'
    elif total_points <= 75:
        severity = 'high'
    else:
        severity = 'critical'

    return {
        'score': total_points,
        'severity': severity,
        'fatalities_points': fatality_points,
        'vehicles_points': vehicle_points,
        'injury_points': injury_points,
    }


def score_earthquake(magnitude, depth, intensity=None):
    """Return earthquake metric points and the standard severity label."""
    magnitude = Decimal(str(magnitude or 0))
    depth = Decimal(str(depth or 0))

    if magnitude >= Decimal('7.0'):
        magnitude_points = 30
    elif magnitude >= Decimal('6.0'):
        magnitude_points = 25
    elif magnitude >= Decimal('5.0'):
        magnitude_points = 20
    elif magnitude >= Decimal('4.0'):
        magnitude_points = 10
    else:
        magnitude_points = 0

    if Decimal('0') <= depth <= Decimal('70'):
        depth_points = 20
    elif Decimal('70') < depth <= Decimal('300'):
        depth_points = 5
    else:
        depth_points = 0

    intensity_points_by_level = {
        'I': 0, 'II': 0, 'III': 0,
        'IV': 15, 'V': 15,
        'VI': 30, 'VII': 30,
        'VIII': 45, 'IX': 45,
        'X': 50,
    }
    intensity_level = str(intensity or '').strip().upper()
    if intensity_level.startswith('PEIS '):
        intensity_level = intensity_level[5:]
    intensity_points = intensity_points_by_level.get(intensity_level, 0)

    total_points = min(100, magnitude_points + intensity_points + depth_points)
    if total_points <= 25:
        severity = 'low'
    elif total_points <= 50:
        severity = 'moderate'
    elif total_points <= 75:
        severity = 'high'
    else:
        severity = 'critical'

    return {
        'score': total_points,
        'severity': severity,
        'magnitude_points': magnitude_points,
        'intensity_points': intensity_points,
        'depth_points': depth_points,
    }


def score_medical_emergency(triage_acuity, patient_count, resource_utilization):
    """Return weighted medical emergency points and the standard severity label."""
    triage_points = {
        'green': 0,
        'yellow': 20,
        'red': 40,
    }.get(str(triage_acuity or '').strip().lower(), 0)

    try:
        count = max(0, int(patient_count or 0))
    except (TypeError, ValueError):
        count = 0
    patient_points = 0 if count <= 1 else 15 if count == 2 else 30

    resource_points = {
        'on_site': 0,
        'basic_ambulance': 15,
        'advanced_response': 30,
    }.get(str(resource_utilization or '').strip().lower(), 0)

    total_points = min(100, triage_points + patient_points + resource_points)
    if total_points <= 25:
        severity = 'low'
    elif total_points <= 50:
        severity = 'moderate'
    elif total_points <= 75:
        severity = 'high'
    else:
        severity = 'critical'

    return {
        'score': total_points,
        'severity': severity,
        'triage_points': triage_points,
        'patient_points': patient_points,
        'resource_points': resource_points,
    }


def score_drowning(details):
    """Return drowning outcome, survivor-count, and rescue-complexity points."""
    details = details or {}

    def count(name):
        try:
            return max(0, int(details.get(name) or 0))
        except (TypeError, ValueError):
            return 0

    fatalities = count('fatalities')
    missing = count('missing')
    survivors = count('rescued_alive') + count('revived_cpr')

    vital_status_points = (
        (20 if fatalities == 1 else 40 if fatalities >= 2 else 0)
        + (10 if missing == 1 else 20 if missing >= 2 else 0)
    )
    victim_points = 0 if survivors <= 1 else 10 if survivors <= 3 else 20

    search_ongoing = details.get('search_ongoing') is True
    coast_guard_involved = details.get('coast_guard_involved') is True
    rescue_complexity_points = (
        20 if search_ongoing and coast_guard_involved
        else 10 if search_ongoing or coast_guard_involved
        else 0
    )

    total_points = min(100, vital_status_points + victim_points + rescue_complexity_points)
    if total_points <= 25:
        severity = 'low'
    elif total_points <= 50:
        severity = 'moderate'
    elif total_points <= 75:
        severity = 'high'
    else:
        severity = 'critical'

    return {
        'score': total_points,
        'severity': severity,
        'vital_status_points': vital_status_points,
        'survivor_points': victim_points,
        'rescue_complexity_points': rescue_complexity_points,
    }


def score_fire_incident(details, injury_count):
    """Return fire alarm, displacement, and casualty points with the standard severity label."""
    details = details or {}

    def count(name):
        try:
            return max(0, int(details.get(name) or 0))
        except (TypeError, ValueError):
            return 0

    alarm_points = {
        'no_alarm': 0,
        'first': 15,
        'second': 25,
        'third': 40,
        'fourth': 40,
        'fifth': 40,
        'task_force_alpha': 40,
        'task_force_bravo': 40,
        'under_control': 0,
        'fire_out': 0,
    }.get(str(details.get('alarm_level') or '').strip().lower(), 0)

    families = count('families_affected')
    structures = count('structures_affected')
    displacement_points = max(
        0 if families <= 0 else 10 if families <= 5 else 20 if families <= 20 else 30,
        0 if structures <= 0 else 10 if structures <= 5 else 20 if structures <= 20 else 30,
    )

    casualties = count('fatalities') + max(0, int(injury_count or 0))
    casualty_points = 0 if casualties == 0 else 10 if casualties <= 2 else 20 if casualties <= 5 else 30

    total_points = min(100, alarm_points + displacement_points + casualty_points)
    if total_points <= 25:
        severity = 'low'
    elif total_points <= 50:
        severity = 'moderate'
    elif total_points <= 75:
        severity = 'high'
    else:
        severity = 'critical'

    return {
        'score': total_points,
        'severity': severity,
        'alarm_points': alarm_points,
        'displacement_points': displacement_points,
        'casualty_points': casualty_points,
    }


def score_crime_incident(victim_details):
    """Return fatality, injury, and total-victim points for structured crime outcomes."""
    outcomes = [victim.get('outcome') for victim in victim_details]
    fatalities = sum(outcome == 'deceased' for outcome in outcomes)
    injuries = sum(outcome == 'injured' for outcome in outcomes)
    total_victims = len(outcomes)

    fatality_points = 0 if fatalities == 0 else 20 if fatalities == 1 else 40
    injury_points = 0 if injuries == 0 else 15 if injuries <= 2 else 25 if injuries <= 5 else 40
    victim_points = 0 if total_victims <= 2 else 10 if total_victims <= 5 else 20

    total_points = min(100, fatality_points + injury_points + victim_points)
    if total_points <= 25:
        severity = 'low'
    elif total_points <= 50:
        severity = 'moderate'
    elif total_points <= 75:
        severity = 'high'
    else:
        severity = 'critical'

    return {
        'score': total_points,
        'severity': severity,
        'fatality_points': fatality_points,
        'injury_points': injury_points,
        'victim_points': victim_points,
    }


def score_report_severity(incident_type, details, victim_details, victim_count):
    """Score complete reports with the incident-specific rubric; retain legacy fallback otherwise."""
    config = get_incident_type(incident_type)
    if not config:
        return _legacy_report_severity(incident_type, victim_count)

    details = details or {}
    victim_details = victim_details or []
    try:
        count = max(0, int(victim_count or 0))
    except (TypeError, ValueError):
        count = 0

    key = config['key']
    if key == 'rca':
        complete = (
            details.get('vehicles_involved') is not None
            and details.get('fatalities') is not None
            and count == len(victim_details)
            and all(victim.get('injury_severity') in RCA_INJURY_POINTS for victim in victim_details)
        )
        result = score_road_crash(details, victim_details) if complete else None
    elif key == 'fire':
        complete = all(details.get(name) is not None for name in (
            'alarm_level', 'families_affected', 'structures_affected', 'fatalities',
        )) and count == len(victim_details)
        result = score_fire_incident(details, count) if complete else None
    elif key == 'crime':
        complete = (
            bool(details.get('crime_type'))
            and count == len(victim_details)
            and all(victim.get('outcome') in ('deceased', 'injured', 'not_injured') for victim in victim_details)
        )
        result = score_crime_incident(victim_details) if complete else None
    elif key in ('medical', 'ambulance', 'standby'):
        patient_count = details.get('persons_assisted') if key == 'standby' else count
        complete = (
            details.get('triage_acuity') is not None
            and details.get('resource_utilization') is not None
            and patient_count is not None
            and (key == 'standby' or count == len(victim_details))
        )
        result = score_medical_emergency(
            details.get('triage_acuity'),
            patient_count,
            details.get('resource_utilization'),
        ) if complete else None
    elif key == 'drowning':
        complete = all(name in details and details[name] is not None for name in (
            'rescued_alive', 'revived_cpr', 'fatalities', 'missing',
            'search_ongoing', 'coast_guard_involved',
        ))
        result = score_drowning(details) if complete else None
    else:
        result = None

    if result is not None:
        return result['severity']
    return _legacy_report_severity(incident_type, count)


def _legacy_report_severity(incident_type, victim_count):
    lower = (incident_type or '').lower()
    if victim_count >= 5:
        return 'critical'
    if victim_count >= 3:
        return 'high'
    if 'fire' in lower or 'drowning' in lower or 'crime' in lower:
        return 'moderate'
    if victim_count > 0:
        return 'moderate'
    return 'low'
