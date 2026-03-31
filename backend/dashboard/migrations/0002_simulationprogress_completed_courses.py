from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('dashboard', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='simulationprogress',
            name='completed_courses',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
