from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0004_accountprofile_phone_number'),
    ]

    operations = [
        migrations.CreateModel(
            name='ResidencyVerification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(db_index=True, max_length=254, unique=True)),
                ('barangay_name', models.CharField(max_length=200)),
                ('residential_address', models.TextField()),
                ('proof_document', models.FileField(upload_to='residency_verification_documents/')),
                ('proof_document_name', models.CharField(max_length=255)),
                ('status', models.CharField(choices=[('pending', 'Pending review'), ('verified', 'Verified resident'), ('rejected', 'Rejected')], db_index=True, default='pending', max_length=16)),
                ('rejection_reason', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_residency_verifications', to=settings.AUTH_USER_MODEL)),
                ('user', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='residency_verification', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['status', '-updated_at', '-id'],
            },
        ),
    ]
