from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0002_alter_equipment_name_alter_evacuationcenter_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='evacuationcenter',
            name='capacity',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='evacuationcenter',
            name='current_occupancy',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='evacuationcenter',
            name='status',
            field=models.CharField(
                choices=[
                    ('available', 'Available'),
                    ('full', 'Full'),
                    ('closed', 'Closed'),
                    ('maintenance', 'Under Maintenance'),
                ],
                default='available',
                max_length=20,
            ),
        ),
    ]