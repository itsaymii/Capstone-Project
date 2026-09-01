from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('dashboard', '0003_simulation_quiz_models'),
    ]

    operations = [
        migrations.CreateModel(
            name='SimulationCourseCatalog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(default='default', max_length=64, unique=True)),
                ('courses', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_simulation_course_catalogs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-updated_at', '-id'],
            },
        ),
    ]
