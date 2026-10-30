from django.db import migrations

from incidents.teams import TEAM_NAMES


def team_from_filing_account(apps, schema_editor):
    """
    Older reports used the filing account's name as the team ("Juan Dela Cruz", "field_responder").
    Where that account now has a team, use it. Reports from accounts without a team keep their old value.
    """
    IncidentReport = apps.get_model('incidents', 'IncidentReport')
    AccountProfile = apps.get_model('api', 'AccountProfile')
    team_by_user = dict(AccountProfile.objects.exclude(team='').values_list('user_id', 'team'))
    for report in IncidentReport.objects.exclude(responder_team__in=TEAM_NAMES).exclude(created_by=None):
        team = team_by_user.get(report.created_by_id)
        if team:
            IncidentReport.objects.filter(pk=report.pk).update(responder_team=team)


class Migration(migrations.Migration):

    dependencies = [
        ('incidents', '0009_team_names_without_prefix'),
        ('api', '0007_accountprofile_team'),
    ]

    operations = [
        migrations.RunPython(team_from_filing_account, migrations.RunPython.noop),
    ]
