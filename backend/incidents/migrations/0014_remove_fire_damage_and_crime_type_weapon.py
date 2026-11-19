from django.db import migrations


class Migration(migrations.Migration):
    """The report form no longer asks for estimated fire damage, the type of crime or the weapon."""

    dependencies = [
        ('incidents', '0013_merge_team_text_and_normalization'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='firereportdetails',
            name='estimated_damage',
        ),
        migrations.RemoveField(
            model_name='crimeincidentdetails',
            name='crime_type',
        ),
        migrations.RemoveField(
            model_name='crimeincidentdetails',
            name='weapon',
        ),
    ]
