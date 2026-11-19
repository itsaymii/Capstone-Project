"""
Fields that belong to each incident type on a responder report.

Every incident type has its own set of "details" fields, so a report only stores what makes sense
for that type (for example, a Stand-by Medical Team report has event fields and no victim list,
and a road crash has vehicle fields that no other type has).

The frontend has the same list in frontend/src/data/incidentTypeFields.ts. When you add, remove,
or rename a field here, change it there too.

This module has no Django imports, so it is easy to test:
    python manage.py test incidents.tests_incident_details
"""

from datetime import time
from decimal import Decimal, InvalidOperation

TEXT_MAX_LENGTH = 200


# Hospitals in Lucena City, for the hospital dropdowns. The form also has "Others" with a text box,
# so a hospital outside this list can still be typed in. Keep in step with incidentTypeFields.ts.
LUCENA_HOSPITALS = [
    'Quezon Medical Center',
    'Lucena United Doctors Hospital and Medical Center',
    'Mount Carmel Diocesan General Hospital',
    'Lucena MMG General Hospital',
    'St. Anne General Hospital',
    'Camp Nakar Station Hospital',
]
HOSPITAL_CHOICES = [(name, name) for name in LUCENA_HOSPITALS]


def field(name, label, kind, required=False, choices=None, minimum=0, maximum=None):
    """
    kind: 'choice' (one value), 'multi_choice' (list), 'int', 'decimal', 'text', 'bool', 'time' (HH:MM),
    or 'choice_other' (pick from choices or type another value; saved as text).
    choices: list of (value, label) for 'choice', 'multi_choice' and 'choice_other'.
    """
    return {
        'name': name,
        'label': label,
        'kind': kind,
        'required': required,
        'choices': choices or [],
        'minimum': minimum,
        'maximum': maximum,
    }



INCIDENT_TYPES = {
    'RCA': {
        'key': 'rca',
        'label': 'Road Crash (RCA)',
        'hazard': 'Vehicular Accident',
        'victims': {'allowed': True, 'label': 'Persons involved', 'min': 0, 'max': None},
        'fields': [
            field('vehicles_involved', 'Number of vehicles involved', 'int', required=True, minimum=1),
            field('vehicle_types', 'Vehicle types', 'multi_choice', required=True, choices=[
                ('motorcycle', 'Motorcycle'), ('tricycle', 'Tricycle'), ('jeepney', 'Jeepney'),
                ('car', 'Car'), ('van_suv', 'Van / SUV'), ('truck', 'Truck'), ('bus', 'Bus'),
                ('bicycle', 'Bicycle'), ('e_bike', 'E-bike'), ('other', 'Other'),
            ]),
            field('collision_type', 'Type of collision', 'choice', required=True, choices=[
                ('head_on', 'Head-on'), ('rear_end', 'Rear-end'), ('side_swipe', 'Side-swipe'),
                ('self_accident', 'Self-accident'), ('hit_pedestrian', 'Hit a pedestrian'),
                ('rollover', 'Rollover'), ('other', 'Other'),
            ]),
            field('suspected_cause', 'Suspected cause', 'choice', choices=[
                ('overspeeding', 'Overspeeding'), ('drunk_driving', 'Drunk driving'),
                ('brake_failure', 'Brake / mechanical failure'), ('reckless_overtaking', 'Reckless overtaking'),
                ('road_condition', 'Road condition'), ('unknown', 'Unknown'), ('other', 'Other'),
            ]),
            field('road_condition', 'Road condition', 'choice', choices=[
                ('dry', 'Dry'), ('wet', 'Wet / slippery'), ('dark', 'Dark / poorly lit'),
                ('under_construction', 'Under construction'), ('damaged', 'Damaged / potholes'),
            ]),
            field('fatalities', 'Fatalities', 'int'),
            field('traffic_blocked', 'Traffic blocked', 'bool'),
            field('police_notified', 'PNP notified', 'bool'),
            field('police_blotter_no', 'Police blotter no.', 'text'),
        ],
        'victim_fields': [
            field('person_role', 'Role', 'choice', required=True, choices=[
                ('driver', 'Driver'), ('passenger', 'Passenger'), ('pedestrian', 'Pedestrian'),
            ]),
            field('protective_gear', 'Helmet / seatbelt', 'choice', choices=[
                ('helmet', 'Wearing helmet'), ('seatbelt', 'Wearing seatbelt'),
                ('none', 'None'), ('not_applicable', 'Not applicable'),
            ]),
        ],
    },
    'Fire Incident': {
        'key': 'fire',
        'label': 'Fire Incident',
        'hazard': 'Fire',
        'victims': {'allowed': True, 'label': 'Casualties', 'min': 0, 'max': None},
        'fields': [
            field('structure_type', 'What burned', 'choice', required=True, choices=[
                ('residential', 'Residential'), ('commercial', 'Commercial'), ('industrial', 'Industrial'),
                ('vehicle', 'Vehicle'), ('grass_vegetation', 'Grass / vegetation'), ('other', 'Other'),
            ]),
            field('alarm_level', 'Highest alarm level', 'choice', required=True, choices=[
                ('first', '1st alarm'), ('second', '2nd alarm'), ('third', '3rd alarm'),
                ('fourth', '4th alarm'), ('fifth', '5th alarm'),
                ('task_force_alpha', 'Task Force Alpha'), ('task_force_bravo', 'Task Force Bravo'),
                ('under_control', 'Fire under control'), ('fire_out', 'Fire out'),
            ]),
            field('suspected_cause', 'Suspected cause', 'choice', choices=[
                ('electrical', 'Electrical'), ('lpg', 'LPG / gas leak'), ('cooking', 'Cooking'),
                ('candle', 'Candle / open flame'), ('smoking', 'Cigarette'), ('arson', 'Arson'),
                ('unknown', 'Unknown'),
            ]),
            field('structures_affected', 'Structures affected', 'int'),
            field('families_affected', 'Families affected / displaced', 'int'),
            field('fatalities', 'Fatalities', 'int'),
            field('bfp_present', 'BFP on scene', 'bool'),
            field('fire_out_time', 'Time declared fire out', 'time'),
        ],
        'victim_fields': [
            field('injury_type', 'Injury', 'choice', choices=[
                ('burns', 'Burns'), ('smoke_inhalation', 'Smoke inhalation'), ('other', 'Other'),
            ]),
        ],
    },
    'Crime Against Person/Property': {
        'key': 'crime',
        'label': 'Crime Against Person/Property',
        'hazard': 'Crime',
        'victims': {'allowed': True, 'label': 'Victims', 'min': 0, 'max': None},
        'fields': [
            field('suspects', 'Number of suspects', 'int'),
            field('suspect_status', 'Suspect status', 'choice', choices=[
                ('at_large', 'At large'), ('apprehended', 'Apprehended'), ('unknown', 'Unknown'),
            ]),
            field('pnp_coordinated', 'Coordinated with PNP', 'bool'),
            field('police_blotter_no', 'Police blotter no.', 'text'),
        ],
        'victim_fields': [],
    },
    'Medical Emergency': {
        'key': 'medical',
        'label': 'Medical Emergency',
        'hazard': 'Medical Emergency',
        'victims': {'allowed': True, 'label': 'Patients', 'min': 1, 'max': None},
        'fields': [
            field('chief_complaint', 'Chief complaint', 'choice', required=True, choices=[
                ('chest_pain', 'Chest pain'), ('difficulty_breathing', 'Difficulty breathing'),
                ('stroke_symptoms', 'Stroke symptoms'), ('seizure', 'Seizure'), ('injury', 'Injury / wound'),
                ('fainting', 'Fainting'), ('fever', 'High fever'), ('other', 'Other'),
            ]),
            field('consciousness', 'Level of consciousness (AVPU)', 'choice', required=True, choices=[
                ('alert', 'Alert'), ('voice', 'Responds to voice'), ('pain', 'Responds to pain'),
                ('unresponsive', 'Unresponsive'),
            ]),
            field('transported', 'Transported to hospital', 'bool'),
            field('hospital', 'Hospital', 'choice_other', choices=HOSPITAL_CHOICES),
        ],
        'victim_fields': [
            field('blood_pressure', 'Blood pressure (e.g. 120/80)', 'text'),
            field('pulse_rate', 'Pulse (bpm)', 'int', maximum=300),
            field('respiratory_rate', 'Respiratory rate (/min)', 'int', maximum=100),
            field('oxygen_saturation', 'SpO2 (%)', 'int', maximum=100),
            field('temperature', 'Temperature (°C)', 'decimal', maximum=45),
        ],
    },
    'Ambulance Assistance': {
        'key': 'ambulance',
        'label': 'Ambulance Assistance',
        'hazard': 'Medical Emergency',
        'victims': {'allowed': True, 'label': 'Patient', 'min': 1, 'max': 1},
        'fields': [
            field('pickup_location', 'Pick-up location', 'text', required=True),
            field('destination_hospital', 'Destination hospital', 'choice_other', required=True, choices=HOSPITAL_CHOICES),
            field('transport_reason', 'Reason for transport', 'choice', required=True, choices=[
                ('referral', 'Referral'), ('dialysis', 'Dialysis'), ('discharge', 'Discharge / going home'),
                ('transfer', 'Hospital transfer'), ('check_up', 'Check-up'), ('other', 'Other'),
            ]),
            field('ambulance_unit', 'Ambulance unit / plate no.', 'text'),
            field('departure_time', 'Departure time', 'time'),
            field('arrival_time', 'Arrival time', 'time'),
            field('condition_on_arrival', 'Patient condition on arrival', 'choice', choices=[
                ('stable', 'Stable'), ('improved', 'Improved'), ('deteriorated', 'Deteriorated'),
                ('deceased', 'Deceased'),
            ]),
        ],
        'victim_fields': [],
    },
    'Stand-by Medical Team': {
        'key': 'standby',
        'label': 'Stand-by Medical Team',
        'hazard': 'Medical Emergency',
        'victims': {'allowed': False, 'label': None, 'min': 0, 'max': 0},
        'fields': [
            field('event_name', 'Event name', 'text', required=True),
            field('venue', 'Venue', 'text', required=True),
            field('organizer', 'Organizer', 'text'),
            field('duty_start', 'Duty start', 'time'),
            field('duty_end', 'Duty end', 'time'),
            field('crowd_estimate', 'Estimated crowd size', 'int'),
            field('team_members', 'Team members deployed', 'int'),
            field('persons_assisted', 'Persons assisted', 'int', required=True),
            field('cases_handled', 'Cases handled', 'multi_choice', choices=[
                ('minor_injury', 'Minor injury'), ('heat_exhaustion', 'Heat exhaustion'),
                ('dizziness', 'Dizziness'), ('fainting', 'Fainting'), ('hypertension', 'High blood pressure'),
                ('other', 'Other'),
            ]),
            field('hospital', 'Hospital referred to', 'choice_other', choices=HOSPITAL_CHOICES),
        ],
        'victim_fields': [],
    },
    'Drowning': {
        'key': 'drowning',
        'label': 'Drowning',
        'hazard': 'Drowning',
        'victims': {'allowed': True, 'label': 'Victims', 'min': 0, 'max': None},
        'fields': [
            field('water_body', 'Where', 'choice', required=True, choices=[
                ('sea', 'Sea / beach'), ('river', 'River'), ('creek', 'Creek'), ('pool', 'Swimming pool'),
                ('flood', 'Floodwater'), ('other', 'Other'),
            ]),
            field('activity', 'Activity at the time', 'choice', choices=[
                ('swimming', 'Swimming'), ('fishing', 'Fishing'), ('fell', 'Fell into the water'),
                ('swept_by_flood', 'Swept by flood'), ('other', 'Other'),
            ]),
            field('rescued_alive', 'Rescued alive', 'int'),
            field('revived_cpr', 'Revived with CPR', 'int'),
            field('fatalities', 'Fatalities', 'int'),
            field('missing', 'Still missing', 'int'),
            field('search_ongoing', 'Search and retrieval ongoing', 'bool'),
            field('coast_guard_involved', 'Coast Guard involved', 'bool'),
        ],
        'victim_fields': [],
    },
}


def get_incident_type(incident_type):
    """Config for an incident type label (case-insensitive), or None for unknown types."""
    wanted = str(incident_type or '').strip().lower()
    for label, config in INCIDENT_TYPES.items():
        if label.lower() == wanted:
            return config
    return None


def _clean_value(spec, value):
    """Return (cleaned_value, error_message). Empty values return (None, None)."""
    kind = spec['kind']

    if value is None or (isinstance(value, str) and value.strip() == '') or (kind == 'multi_choice' and value == []):
        return None, None

    if kind in ('text', 'choice_other'):
        # choice_other: a listed choice or any other typed value, so it is checked like text.
        text = str(value).strip()
        if len(text) > TEXT_MAX_LENGTH:
            return None, f'must be {TEXT_MAX_LENGTH} characters or fewer'
        return text, None

    if kind == 'bool':
        if isinstance(value, bool):
            return value, None
        if str(value).strip().lower() in ('true', '1', 'yes'):
            return True, None
        if str(value).strip().lower() in ('false', '0', 'no'):
            return False, None
        return None, 'must be yes or no'

    if kind == 'choice':
        allowed = {choice for choice, _ in spec['choices']}
        if value not in allowed:
            return None, f'"{value}" is not a valid option'
        return value, None

    if kind == 'multi_choice':
        if not isinstance(value, list):
            return None, 'must be a list'
        allowed = {choice for choice, _ in spec['choices']}
        unknown = [item for item in value if item not in allowed]
        if unknown:
            return None, f'"{unknown[0]}" is not a valid option'
        return list(dict.fromkeys(value)), None  # keep order, drop duplicates

    if kind in ('int', 'decimal'):
        try:
            number = Decimal(str(value))
        except (InvalidOperation, ValueError):
            return None, 'must be a number'
        if kind == 'int' and number != number.to_integral_value():
            return None, 'must be a whole number'
        if number < spec['minimum']:
            return None, f'must be at least {spec["minimum"]}'
        if spec['maximum'] is not None and number > spec['maximum']:
            return None, f'must be at most {spec["maximum"]}'
        return (int(number) if kind == 'int' else float(number)), None

    if kind == 'time':
        try:
            hours, minutes = (int(part) for part in str(value).strip().split(':')[:2])
            return time(hours, minutes).strftime('%H:%M'), None
        except (ValueError, TypeError):
            return None, 'must be a time like 14:30'

    return None, 'has an unknown field type'


def _clean_fields(specs, data, label_prefix=''):
    """Validate a dict against a list of field specs. Unknown keys are rejected."""
    cleaned, errors = {}, {}

    if data in (None, ''):
        data = {}
    if not isinstance(data, dict):
        return {}, {'details': 'must be an object'}

    known = {spec['name']: spec for spec in specs}
    for key in data:
        if key not in known:
            errors[key] = f'{label_prefix}"{key}" does not belong to this incident type'

    for spec in specs:
        value, error = _clean_value(spec, data.get(spec['name']))
        if error:
            errors[spec['name']] = f'{label_prefix}{spec["label"]} {error}'
        elif value is None:
            if spec['required']:
                errors[spec['name']] = f'{label_prefix}{spec["label"]} is required'
        else:
            cleaned[spec['name']] = value

    return cleaned, errors


def validate_report_details(incident_type, details, victims=None):
    """
    Check a report's type-specific details and victim list.

    Returns (cleaned_details, cleaned_victim_details, errors).
    - cleaned_details: the details dict with only this type's fields, converted to proper types
    - cleaned_victim_details: one dict per victim with only this type's victim fields
    - errors: {} when valid, otherwise {'details': {...}} and/or {'victims': '...'}
    """
    victims = victims or []
    config = get_incident_type(incident_type)

    if config is None:
        # Unknown / custom type: no extra fields are allowed.
        if details:
            return {}, [{} for _ in victims], {'details': {'details': 'This incident type has no extra fields.'}}
        return {}, [{} for _ in victims], {}

    cleaned, field_errors = _clean_fields(config['fields'], details)
    errors = {'details': field_errors} if field_errors else {}

    rules = config['victims']
    if not rules['allowed'] and victims:
        errors['victims'] = f'{config["label"]} reports do not have a victim list.'
    elif len(victims) < rules['min']:
        errors['victims'] = f'Add at least {rules["min"]} {rules["label"].lower()}.'
    elif rules['max'] is not None and len(victims) > rules['max']:
        errors['victims'] = f'Only {rules["max"]} {rules["label"].lower()} allowed.'

    victim_details, victim_errors = [], {}
    for index, victim in enumerate(victims, start=1):
        extra = (victim or {}).get('details') or {}
        cleaned_victim, errors_for_victim = _clean_fields(config['victim_fields'], extra, label_prefix=f'#{index} ')
        victim_details.append(cleaned_victim)
        if errors_for_victim:
            victim_errors[index] = errors_for_victim
    if victim_errors and 'victims' not in errors:
        errors['victims'] = {f'#{index}': errs for index, errs in victim_errors.items()}

    return cleaned, victim_details, errors


def detail_table_values(incident_type, details, victim_count):
    """
    Values to copy into the existing per-type tables when a report is approved.

    Returns (table, values) where table is one of 'fire', 'vehicular', 'crime', 'medical', 'drowning',
    or (None, {}) when the type has no table.
    """
    config = get_incident_type(incident_type)
    details = details or {}
    key = config['key'] if config else None

    def label_of(field_name, value):
        for spec in config['fields']:
            if spec['name'] == field_name:
                return dict(spec['choices']).get(value, value)
        return value

    if key == 'fire':
        return 'fire', {
            'cause': label_of('suspected_cause', details.get('suspected_cause', '')) or '',
            # Estimated damage is no longer asked on the report form.
            'damage_estimate': None,
            'casualties': details.get('fatalities', 0),
            'injuries': victim_count,
            'structures_affected': details.get('structures_affected', 0),
        }

    if key == 'rca':
        return 'vehicular', {
            'vehicles_involved': details.get('vehicles_involved', 1),
            'casualties': details.get('fatalities', 0),
            'injuries': victim_count,
            'cause': label_of('suspected_cause', details.get('suspected_cause', '')) or '',
            'vehicle_types': ', '.join(label_of('vehicle_types', item) for item in details.get('vehicle_types', [])),
        }

    if key == 'crime':
        return 'crime', {
            # The report form no longer asks for the type of crime.
            'crime_type': 'Crime',
            'suspects': details.get('suspects', 0),
            'victims': victim_count,
            'arrested': details.get('suspect_status') == 'apprehended',
        }

    if key == 'medical':
        return 'medical', {
            'patient_count': max(victim_count, 1),
            'emergency_type': label_of('chief_complaint', details.get('chief_complaint', '')) or 'Medical Emergency',
            'transported': victim_count if details.get('transported') else 0,
            'hospital': details.get('hospital', ''),
        }

    if key == 'ambulance':
        return 'medical', {
            'patient_count': max(victim_count, 1),
            'emergency_type': 'Ambulance Assistance: ' + label_of('transport_reason', details.get('transport_reason', '')),
            'transported': max(victim_count, 1),
            'hospital': details.get('destination_hospital', ''),
        }

    if key == 'standby':
        return 'medical', {
            'patient_count': details.get('persons_assisted', 0),
            'emergency_type': 'Stand-by Medical Team: ' + details.get('event_name', ''),
            'transported': 0,
            'hospital': '',
        }

    if key == 'drowning':
        return 'drowning', {
            'victims': victim_count,
            'rescued': details.get('rescued_alive', 0) + details.get('revived_cpr', 0),
            'fatalities': details.get('fatalities', 0),
            'water_body': label_of('water_body', details.get('water_body', '')) or '',
        }

    return None, {}


# Column sizes of the existing detail tables (incidents/models.py), so copied text always fits.
DETAIL_TEXT_LIMITS = {
    'fire': {'cause': 200},
    'vehicular': {'cause': 200},
    'crime': {'crime_type': 100},
    'medical': {'emergency_type': 100, 'hospital': 200},
    'drowning': {'water_body': 200},
}


def fit_detail_values(table, values):
    """Trim text values to the column limits of `table`."""
    limits = DETAIL_TEXT_LIMITS.get(table, {})
    return {
        name: (value[: limits[name]] if name in limits and isinstance(value, str) else value)
        for name, value in values.items()
    }