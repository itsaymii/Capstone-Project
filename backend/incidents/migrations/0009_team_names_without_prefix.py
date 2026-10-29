from django.db import migrations

from incidents.teams import team_name


def remove_team_prefix(apps, schema_editor):
    """Existing reports: "Team Alpha" -> "Alpha" (new reports are cleaned in IncidentReport.save)."""
    IncidentReport = apps.get_model('incidents', 'IncidentReport')
    for report in IncidentReport.objects.filter(responder_team__iregex=r'^\s*team'):
        cleaned = team_name(report.responder_team)
        if cleaned != report.responder_team:
            IncidentReport.objects.filter(pk=report.pk).update(responder_team=cleaned)


class Migration(migrations.Migration):

    dependencies = [
        ('incidents', '0008_incident_type_details'),
    ]

    operations = [
        migrations.RunPython(remove_team_prefix, migrations.RunPython.noop),
    ]
