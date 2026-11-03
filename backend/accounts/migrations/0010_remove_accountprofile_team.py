import re

from django.db import migrations


TEAM_CODES = {'alpha', 'bravo', 'charlie'}


def team_code_for_legacy_value(value):
    normalized = re.sub(r'^\s*team\b[\s:.\-_]*', '', str(value or ''), flags=re.IGNORECASE)
    code = normalized.strip().casefold()
    return code if code in TEAM_CODES else None


def migrate_profile_teams(apps, schema_editor):
    AccountProfile = apps.get_model('api', 'AccountProfile')
    ResponderTeam = apps.get_model('incidents', 'ResponderTeam')
    database = schema_editor.connection.alias
    team_ids = dict(
        ResponderTeam.objects.using(database).values_list('code', 'pk')
    )
    profiles = list(
        AccountProfile.objects.using(database)
        .filter(responder_team__isnull=True)
        .exclude(team='')
        .values_list('pk', 'team')
    )

    assignments = []
    for profile_id, legacy_team in profiles:
        code = team_code_for_legacy_value(legacy_team)
        if code is None or code not in team_ids:
            raise RuntimeError(
                f'Cannot migrate AccountProfile {profile_id}: unknown responder team {legacy_team!r}.'
            )
        assignments.append((profile_id, team_ids[code]))

    for profile_id, team_id in assignments:
        AccountProfile.objects.using(database).filter(pk=profile_id).update(responder_team_id=team_id)


def restore_profile_teams(apps, schema_editor):
    AccountProfile = apps.get_model('api', 'AccountProfile')
    database = schema_editor.connection.alias
    labels = {'alpha': 'Alpha', 'bravo': 'Bravo', 'charlie': 'Charlie'}
    profiles = (
        AccountProfile.objects.using(database)
        .filter(responder_team__isnull=False)
        .values_list('pk', 'responder_team__code')
    )
    for profile_id, code in profiles.iterator():
        if code in labels:
            AccountProfile.objects.using(database).filter(pk=profile_id).update(team=labels[code])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_merge_team_and_responder_team'),
        ('incidents', '0013_merge_team_text_and_normalization'),
    ]

    operations = [
        migrations.RunPython(migrate_profile_teams, restore_profile_teams),
        migrations.RemoveField(
            model_name='accountprofile',
            name='team',
        ),
    ]
