from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('incidents', '0007_incidentreport_barangay_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='incidentreport',
            name='details',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='victimdetail',
            name='details',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]