"""
Realistic sample values for the type-specific report fields (incidents/incident_types.py).

Used by `python manage.py generate_accomplishment_reports` to create demo data that passes the same
validation as real reports, so the detail tables and analytics charts have meaningful data.

No Django imports, so it is easy to test.
"""

from datetime import datetime, timedelta

from .incident_types import LUCENA_HOSPITALS, get_incident_type

STANDBY_EVENTS = [
    ('Pasayahan sa Lucena', 'Perez Park', 'City Government of Lucena'),
    ('Lucena City Fun Run', 'Lucena City Hall Grounds', 'City Sports Office'),
    ('Barangay Basketball League', 'Barangay Covered Court', 'Sangguniang Kabataan'),
    ('Barangay Fiesta', 'Barangay Plaza', 'Barangay Council'),
    ('School Graduation Rites', 'Quezon Convention Center', 'DepEd Lucena'),
    ('Holy Week Procession', 'St. Ferdinand Cathedral', 'Diocese of Lucena'),
    ('Christmas Concert', 'Perez Park', 'City Tourism Office'),
]

# Rough real-world weights so charts show a believable mix instead of an even spread.
WEIGHTS = {
    ('RCA', 'vehicle_types'): {'motorcycle': 40, 'tricycle': 18, 'jeepney': 10, 'car': 14, 'van_suv': 6,
                               'truck': 5, 'bus': 2, 'bicycle': 3, 'e_bike': 2, 'other': 1},
    ('RCA', 'suspected_cause'): {'overspeeding': 30, 'drunk_driving': 15, 'brake_failure': 10,
                                 'reckless_overtaking': 20, 'road_condition': 10, 'unknown': 12, 'other': 3},
    ('RCA', 'road_condition'): {'dry': 55, 'wet': 25, 'dark': 12, 'under_construction': 4, 'damaged': 4},
    ('Fire Incident', 'structure_type'): {'residential': 60, 'commercial': 15, 'industrial': 5, 'vehicle': 8,
                                          'grass_vegetation': 10, 'other': 2},
    ('Fire Incident', 'suspected_cause'): {'electrical': 45, 'lpg': 12, 'cooking': 15, 'candle': 8,
                                           'smoking': 6, 'arson': 3, 'unknown': 11},
    ('Fire Incident', 'alarm_level'): {'first': 40, 'second': 20, 'third': 8, 'fourth': 3, 'fifth': 1,
<<<<<<< HEAD
                                       'task_force_alpha': 1, 'under_control': 7, 'fire_out': 20},
=======
                                       'task_force_alpha': 1, 'task_force_bravo': 1, 'no_alarm': 2,
                                       'under_control': 7, 'fire_out': 20},
    ('Crime Against Person/Property', 'crime_type'): {'theft': 35, 'robbery': 12, 'physical_injury': 25,
                                                      'stabbing': 8, 'shooting': 4, 'domestic_violence': 12, 'other': 4},
    ('Crime Against Person/Property', 'outcome'): {'deceased': 2, 'injured': 28, 'not_injured': 70},
>>>>>>> 7f31639f9beb2e97952a7d04c4df5c50ff6c6aff
    ('Medical Emergency', 'chief_complaint'): {'chest_pain': 14, 'difficulty_breathing': 16, 'stroke_symptoms': 10,
                                               'seizure': 8, 'injury': 22, 'fainting': 15, 'fever': 10, 'other': 5},
    ('Medical Emergency', 'consciousness'): {'alert': 60, 'voice': 18, 'pain': 12, 'unresponsive': 10},
    ('Ambulance Assistance', 'transport_reason'): {'referral': 30, 'dialysis': 25, 'discharge': 20,
                                                   'transfer': 15, 'check_up': 8, 'other': 2},
    ('Drowning', 'water_body'): {'sea': 50, 'river': 22, 'creek': 8, 'pool': 8, 'flood': 10, 'other': 2},
    ('Drowning', 'activity'): {'swimming': 55, 'fishing': 15, 'fell': 15, 'swept_by_flood': 10, 'other': 5},
}

# How many victims each type usually has (kept at 4 or fewer so no "critical" SMS alerts are triggered).
VICTIM_COUNT_RANGE = {
    'RCA': (0, 4),
    'Fire Incident': (0, 3),
    'Crime Against Person/Property': (1, 3),
    'Medical Emergency': (1, 2),
    'Ambulance Assistance': (1, 1),
    'Stand-by Medical Team': (0, 0),
    'Drowning': (1, 3),
}


def _choice_values(incident_type, field_name, victim=False):
    config = get_incident_type(incident_type)
    specs = config['victim_fields'] if victim else config['fields']
    for spec in specs:
        if spec['name'] == field_name:
            return [value for value, _ in spec['choices']]
    raise KeyError(field_name)


def _pick(rng, incident_type, field_name, victim=False):
    values = _choice_values(incident_type, field_name, victim)
    weights = WEIGHTS.get((incident_type, field_name))
    if weights:
        return rng.choices(values, weights=[weights.get(value, 1) for value in values])[0]
    return rng.choice(values)


def _time(moment):
    return moment.strftime('%H:%M')


def victim_count_for(rng, incident_type):
    low, high = VICTIM_COUNT_RANGE.get(incident_type, (0, 4))
    return rng.randint(low, high)


def sample_details(rng, incident_type, victim_count, occurred_at, barangay_name):
    """Type-specific details for one report. `occurred_at` is a datetime used for time fields."""
    details = {}

    if incident_type == 'RCA':
        vehicles = rng.choices([1, 2, 3], weights=[35, 55, 10])[0]
        # One type per vehicle; two motorcycles count as one "motorcycle" entry.
        types = list(dict.fromkeys(_pick(rng, incident_type, 'vehicle_types') for _ in range(vehicles)))
        details = {
            'vehicles_involved': vehicles,
            'vehicle_types': types,
            'collision_type': rng.choice(['self_accident', 'hit_pedestrian', 'rollover']) if vehicles == 1
            else rng.choices(['head_on', 'rear_end', 'side_swipe', 'other'], weights=[20, 35, 40, 5])[0],
            'suspected_cause': _pick(rng, incident_type, 'suspected_cause'),
            'road_condition': _pick(rng, incident_type, 'road_condition'),
            'traffic_blocked': rng.random() < 0.45,
            'police_notified': rng.random() < 0.75,
            'fatalities': 0,
        }
        if victim_count and rng.random() < 0.06:
            details['fatalities'] = 1
        if details['police_notified'] and rng.random() < 0.6:
            details['police_blotter_no'] = f'LCPS-{occurred_at.year}-{rng.randint(1000, 9999)}'

    elif incident_type == 'Fire Incident':
        structure = _pick(rng, incident_type, 'structure_type')
        alarm = _pick(rng, incident_type, 'alarm_level')
        big = alarm in ('third', 'fourth', 'fifth', 'task_force_alpha', 'task_force_bravo')
        structures = 0 if structure in ('vehicle', 'grass_vegetation') else rng.randint(4, 25) if big else rng.randint(1, 3)
        details = {
            'structure_type': structure,
            'alarm_level': alarm,
            'suspected_cause': _pick(rng, incident_type, 'suspected_cause'),
            'structures_affected': structures,
            'families_affected': structures * rng.randint(1, 3) if structure == 'residential' else 0,
            'bfp_present': rng.random() < 0.92,
            'fire_out_time': _time(occurred_at + timedelta(minutes=rng.randint(25, 240 if big else 90))),
            'fatalities': 0,
        }
        if victim_count and rng.random() < 0.08:
            details['fatalities'] = 1

    elif incident_type == 'Crime Against Person/Property':
        details = {
            'suspects': rng.choices([1, 2, 3], weights=[70, 22, 8])[0],
            'suspect_status': rng.choices(['at_large', 'apprehended', 'unknown'], weights=[45, 40, 15])[0],
            'pnp_coordinated': rng.random() < 0.9,
        }
        if details['pnp_coordinated'] and rng.random() < 0.7:
            details['police_blotter_no'] = f'LCPS-{occurred_at.year}-{rng.randint(1000, 9999)}'

    elif incident_type == 'Medical Emergency':
        transported = rng.random() < 0.7
        details = {
            'chief_complaint': _pick(rng, incident_type, 'chief_complaint'),
            'consciousness': _pick(rng, incident_type, 'consciousness'),
            'transported': transported,
            'triage_acuity': rng.choices(['red', 'yellow', 'green'], weights=[10, 25, 65])[0],
            'resource_utilization': (
                rng.choices(['basic_ambulance', 'advanced_response'], weights=[80, 20])[0]
                if transported else 'on_site'
            ),
        }
        if transported:
            details['hospital'] = rng.choice(LUCENA_HOSPITALS)

    elif incident_type == 'Ambulance Assistance':
        departure = occurred_at + timedelta(minutes=rng.randint(5, 20))
        details = {
            'pickup_location': f'{barangay_name}, Lucena City',
            'destination_hospital': rng.choice(LUCENA_HOSPITALS),
            'transport_reason': _pick(rng, incident_type, 'transport_reason'),
            'ambulance_unit': f'LCDRRMO Ambulance {rng.randint(1, 3)}',
            'departure_time': _time(departure),
            'arrival_time': _time(departure + timedelta(minutes=rng.randint(8, 35))),
            'condition_on_arrival': rng.choices(['stable', 'improved', 'deteriorated'], weights=[70, 22, 8])[0],
            'triage_acuity': rng.choices(['red', 'yellow', 'green'], weights=[10, 25, 65])[0],
            'resource_utilization': rng.choices(
                ['basic_ambulance', 'advanced_response'], weights=[80, 20],
            )[0],
        }

    elif incident_type == 'Stand-by Medical Team':
        event, venue, organizer = rng.choice(STANDBY_EVENTS)
        start = occurred_at.replace(minute=0)
        cases = rng.sample(['minor_injury', 'heat_exhaustion', 'dizziness', 'fainting', 'hypertension'], rng.randint(0, 3))
        details = {
            'event_name': event,
            'venue': venue if venue != 'Barangay Covered Court' else f'{barangay_name} Covered Court',
            'organizer': organizer,
            'duty_start': _time(start),
            'duty_end': _time(start + timedelta(hours=rng.randint(3, 9))),
            'crowd_estimate': rng.randrange(200, 8000, 50),
            'team_members': rng.randint(3, 8),
            'persons_assisted': rng.randint(len(cases), 25) if cases else 0,
            'triage_acuity': 'green' if cases else 'none',
            'resource_utilization': 'on_site',
        }
        if cases:
            details['cases_handled'] = cases
            if rng.random() < 0.3:
                details['hospital'] = rng.choice(LUCENA_HOSPITALS)

    elif incident_type == 'Drowning':
        outcomes = {'rescued_alive': 0, 'revived_cpr': 0, 'fatalities': 0, 'missing': 0}
        for _ in range(victim_count):
            outcome = rng.choices(list(outcomes), weights=[55, 20, 20, 5])[0]
            outcomes[outcome] += 1
        details = {
            'water_body': _pick(rng, incident_type, 'water_body'),
            'activity': _pick(rng, incident_type, 'activity'),
            **outcomes,
            'search_ongoing': outcomes['missing'] > 0,
            'coast_guard_involved': rng.random() < 0.4,
        }

    return details


def sample_victim_details(rng, incident_type, report_details):
    """Per-victim fields for one victim of a report."""
    if incident_type == 'RCA':
        role = rng.choices(['driver', 'passenger', 'pedestrian'], weights=[50, 35, 15])[0]
        if role == 'pedestrian':
            gear = 'not_applicable'
        elif 'motorcycle' in report_details.get('vehicle_types', []) or 'e_bike' in report_details.get('vehicle_types', []):
            gear = rng.choices(['helmet', 'none'], weights=[65, 35])[0]
        else:
            gear = rng.choices(['seatbelt', 'none'], weights=[60, 40])[0]
        injury_severity = rng.choices(
            ['none', 'minor_first_aid', 'severe_hospital_transport'],
            weights=[35, 55, 10],
        )[0]
        return {
            'person_role': role,
            'injury_severity': injury_severity,
            'protective_gear': gear,
        }

    if incident_type == 'Fire Incident':
        return {'injury_type': rng.choices(['burns', 'smoke_inhalation', 'other'], weights=[45, 45, 10])[0]}

    if incident_type == 'Medical Emergency':
        unstable = report_details.get('consciousness') in ('pain', 'unresponsive')
        systolic = rng.randint(85, 110) if unstable else rng.randint(105, 160)
        return {
            'blood_pressure': f'{systolic}/{rng.randint(60, 100)}',
            'pulse_rate': rng.randint(100, 140) if unstable else rng.randint(65, 105),
            'respiratory_rate': rng.randint(22, 32) if unstable else rng.randint(14, 22),
            'oxygen_saturation': rng.randint(84, 93) if unstable else rng.randint(94, 100),
            'temperature': round(rng.uniform(38.0, 39.8) if report_details.get('chief_complaint') == 'fever'
                                 else rng.uniform(36.2, 37.4), 1),
        }

    if incident_type == 'Crime Against Person/Property':
        return {'outcome': _pick(rng, incident_type, 'outcome', victim=True)}

    return {}


def sample_report_datetime(rng, start_year, end_year, now, recent_share=0.3, recent_days=120):
    """
    A report date between start_year and now. `recent_share` of reports fall in the last `recent_days`,
    so pages that look at recent data (risk scores, last 30/90 days) have something to show.
    """
    if rng.random() < recent_share:
        return now - timedelta(days=rng.uniform(0, recent_days))

    start = datetime(start_year, 1, 1, tzinfo=now.tzinfo)
    end = min(now, datetime(end_year, 12, 31, 23, 59, tzinfo=now.tzinfo))
    if start >= end:
        return now - timedelta(days=rng.uniform(0, recent_days))
    return start + (end - start) * rng.random()