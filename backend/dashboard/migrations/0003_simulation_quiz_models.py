from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('dashboard', '0002_simulationprogress_completed_courses'),
    ]

    operations = [
        migrations.CreateModel(
            name='SimulationModuleQuiz',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('course_id', models.CharField(db_index=True, max_length=120)),
                ('lesson_id', models.CharField(db_index=True, max_length=120)),
                ('lesson_title', models.CharField(blank=True, max_length=255)),
                ('title', models.CharField(max_length=255)),
                ('passing_score', models.PositiveSmallIntegerField(default=80)),
                ('version', models.PositiveIntegerField(default=1)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')], db_index=True, default='draft', max_length=12)),
                ('source_pdf', models.FileField(blank=True, null=True, upload_to='simulation_quiz_pdfs/')),
                ('source_pdf_name', models.CharField(blank=True, max_length=255)),
                ('parse_confidence', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('parse_notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_simulation_quizzes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-updated_at', '-id'],
                'indexes': [models.Index(fields=['course_id', 'lesson_id', 'status'], name='dashboard_si_course__edcb1c_idx')],
            },
        ),
        migrations.CreateModel(
            name='SimulationQuizQuestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(default=0)),
                ('prompt', models.TextField()),
                ('explanation', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('quiz', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='questions', to='dashboard.simulationmodulequiz')),
            ],
            options={
                'ordering': ['order', 'id'],
            },
        ),
        migrations.CreateModel(
            name='SimulationQuizChoice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(default=0)),
                ('text', models.TextField()),
                ('is_correct', models.BooleanField(default=False)),
                ('question', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='choices', to='dashboard.simulationquizquestion')),
            ],
            options={
                'ordering': ['order', 'id'],
            },
        ),
        migrations.CreateModel(
            name='SimulationQuizAttempt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('answers', models.JSONField(blank=True, default=dict)),
                ('score', models.PositiveSmallIntegerField(default=0)),
                ('total_questions', models.PositiveSmallIntegerField(default=0)),
                ('passed', models.BooleanField(default=False)),
                ('unanswered', models.PositiveSmallIntegerField(default=0)),
                ('attempted_at', models.DateTimeField(auto_now_add=True)),
                ('quiz', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attempts', to='dashboard.simulationmodulequiz')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='simulation_quiz_attempts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-attempted_at', '-id'],
                'indexes': [models.Index(fields=['user', 'quiz', 'attempted_at'], name='dashboard_si_user_id_21b54f_idx')],
            },
        ),
    ]
