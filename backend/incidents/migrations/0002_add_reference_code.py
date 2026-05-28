# Generated migration for adding reference_code field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('incidents', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='incident',
            name='reference_code',
            field=models.CharField(
                blank=True,
                editable=False,
                help_text='Auto-generated reference code (e.g., INC-2025-001)',
                max_length=50,
                null=True,
                unique=True
            ),
        ),
    ]
