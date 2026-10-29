"""
Responder team names. The teams are Alpha, Bravo and Charlie, written without a "Team" prefix,
so reports, tables and team dropdowns show "Alpha" and never "Team Alpha".

No Django imports, so the data migration can use it too.
"""

import re

TEAM_NAMES = ('Alpha', 'Bravo', 'Charlie')

_TEAM_PREFIX = re.compile(r'^\s*team\b[\s:.\-_]*', re.IGNORECASE)


def team_name(value):
    """
    "Team Alpha", "TEAM-bravo" or "team: Charlie" -> "Alpha", "Bravo", "Charlie".
    Other names only lose a leading "Team" ("Team Rescue 1" -> "Rescue 1").
    """
    text = ' '.join(str(value or '').split())
    stripped = _TEAM_PREFIX.sub('', text)
    if not stripped:
        return text  # the name is just "Team": keep it rather than leave it empty

    for name in TEAM_NAMES:
        if stripped.lower() == name.lower():
            return name
    return stripped
