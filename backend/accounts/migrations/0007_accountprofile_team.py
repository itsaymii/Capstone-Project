from django.db import migrations, models

from incidents.teams import TEAM_NAMES, team_name


def team_from_account_name(apps, schema_editor):
    """Responder accounts named "Team Alpha" (or "alpha") get the team Alpha; others are left for an admin to set."""
    AccountProfile = apps.get_model('api', 'AccountProfile')
    for profile in AccountProfile.objects.filter(role='staff').select_related('user'):
        user = profile.user
        for name in (f'{user.first_name} {user.last_name}', user.username):
            team = team_name(name)
            if team in TEAM_NAMES:
                AccountProfile.objects.filter(pk=profile.pk).update(team=team)
                break


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_otp_failed_attempts'),
    ]

    operations = [
        migrations.AddField(
            model_name='accountprofile',
            name='team',
            field=models.CharField(
                blank=True, choices=[('Alpha', 'Alpha'), ('Bravo', 'Bravo'), ('Charlie', 'Charlie')], default='', max_length=20,
            ),
        ),
        migrations.RunPython(team_from_account_name, migrations.RunPython.noop),
    ]
