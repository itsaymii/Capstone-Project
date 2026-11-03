from datetime import datetime

import django.db.models.deletion
from django.db import migrations, models
from django.utils import timezone


def _ensure_course(Course, course_id, title=None):
    course_id = str(course_id or '')
    course, created = Course.objects.get_or_create(
        course_id=course_id,
        defaults={
            'title': title or f'Course {course_id}',
            'is_archived': True,
            'is_placeholder': True,
        },
    )
    return course


def _ensure_lesson(Lesson, course, lesson_id):
    lesson_id = str(lesson_id or '')
    lesson, _ = Lesson.objects.get_or_create(
        course=course,
        lesson_id=lesson_id,
        defaults={'title': lesson_id or 'Lesson', 'is_placeholder': True},
    )
    return lesson


def _copy_course(Course, Objective, Prerequisite, Lesson, Point, ExamQuestion, ExamChoice, Material, raw, archived):
    if not isinstance(raw, dict):
        raise RuntimeError('Cannot normalize a non-object simulation course record.')
    course_id = str(raw.get('id') or '').strip()
    if not course_id:
        raise RuntimeError('Cannot normalize a simulation course without an id.')

    fields = {
        'title': str(raw.get('title') or f'Course {course_id}'),
        'tag': str(raw.get('tag') or 'Preparedness Training'),
        'difficulty': str(raw.get('difficulty') or 'Beginner'),
        'duration': str(raw.get('duration') or '30 min'),
        'description': str(raw.get('description') or ''),
        'audience': str(raw.get('audience') or ''),
        'accent': str(raw.get('accent') or '#0b2a57'),
        'hero_image_url': str(raw.get('heroImageUrl') or ''),
        'hero_image_name': str(raw.get('heroImageName') or ''),
        'is_archived': archived,
        'is_placeholder': False,
    }
    course, _ = Course.objects.update_or_create(course_id=course_id, defaults=fields)

    for model, values in (
        (Objective, raw.get('objectives', [])),
        (Prerequisite, raw.get('prerequisites', [])),
    ):
        if not isinstance(values, list):
            raise RuntimeError(f'Cannot normalize non-list course data for {course_id}.')
        model.objects.filter(course=course).delete()
        model.objects.bulk_create([
            model(course=course, order=index, text=str(value))
            for index, value in enumerate(values)
        ])

    raw_lessons = raw.get('lessonOutline', [])
    if not isinstance(raw_lessons, list):
        raise RuntimeError(f'Cannot normalize non-list lesson outline for course {course_id}.')
    seen_lesson_ids = set()
    for lesson_index, raw_lesson in enumerate(raw_lessons):
        if not isinstance(raw_lesson, dict):
            raise RuntimeError(f'Cannot normalize a non-object lesson in course {course_id}.')
        lesson_id = str(raw_lesson.get('id') or f'lesson-{lesson_index + 1}').strip()
        if lesson_id in seen_lesson_ids:
            raise RuntimeError(f'Duplicate lesson id {lesson_id!r} in course {course_id}.')
        seen_lesson_ids.add(lesson_id)
        lesson, _ = Lesson.objects.update_or_create(
            course=course,
            lesson_id=lesson_id,
            defaults={
                'order': lesson_index,
                'lesson_type': str(raw_lesson.get('lessonType') or 'video'),
                'title': str(raw_lesson.get('title') or f'Lesson {lesson_index + 1}'),
                'duration': str(raw_lesson.get('duration') or '10 min'),
                'video_url': str(raw_lesson.get('videoUrl') or ''),
                'video_file_name': str(raw_lesson.get('videoFileName') or ''),
                'summary': str(raw_lesson.get('summary') or ''),
                'content': str(raw_lesson.get('content') or ''),
                'passing_score': int(raw_lesson.get('passingScore') or 70),
                'is_placeholder': False,
            },
        )
        raw_points = raw_lesson.get('points', [])
        if not isinstance(raw_points, list):
            raise RuntimeError(f'Cannot normalize non-list lesson points for {course_id}:{lesson_id}.')
        lesson.points.all().delete()
        Point.objects.bulk_create([
            Point(lesson=lesson, order=index, text=str(value))
            for index, value in enumerate(raw_points)
        ])

        raw_questions = raw_lesson.get('examQuestions', [])
        if not isinstance(raw_questions, list):
            raise RuntimeError(f'Cannot normalize non-list exam questions for {course_id}:{lesson_id}.')
        lesson.exam_questions.all().delete()
        seen_question_ids = set()
        for question_index, raw_question in enumerate(raw_questions):
            if not isinstance(raw_question, dict):
                raise RuntimeError(f'Cannot normalize a non-object exam question for {course_id}:{lesson_id}.')
            question_id = str(raw_question.get('id') or f'question-{question_index + 1}').strip()
            if question_id in seen_question_ids:
                raise RuntimeError(f'Duplicate exam question id {question_id!r} for {course_id}:{lesson_id}.')
            seen_question_ids.add(question_id)
            question = ExamQuestion.objects.create(
                lesson=lesson,
                question_id=question_id,
                order=question_index,
                prompt=str(raw_question.get('prompt') or ''),
                explanation=str(raw_question.get('explanation') or ''),
            )
            options = raw_question.get('options', [])
            if not isinstance(options, list):
                raise RuntimeError(f'Cannot normalize non-list exam options for {course_id}:{lesson_id}:{question_id}.')
            try:
                correct_index = int(raw_question.get('correctOptionIndex', 0))
            except (TypeError, ValueError):
                correct_index = 0
            correct_index = max(0, min(correct_index, max(0, len(options) - 1)))
            ExamChoice.objects.bulk_create([
                ExamChoice(
                    question=question,
                    order=index,
                    text=str(option),
                    is_correct=index == correct_index,
                )
                for index, option in enumerate(options)
            ])

    raw_materials = raw.get('learningMaterials', [])
    if not isinstance(raw_materials, list):
        raise RuntimeError(f'Cannot normalize non-list learning materials for course {course_id}.')
    course.learning_materials.all().delete()
    seen_material_ids = set()
    for index, raw_material in enumerate(raw_materials):
        if not isinstance(raw_material, dict):
            raise RuntimeError(f'Cannot normalize a non-object learning material for course {course_id}.')
        material_id = str(raw_material.get('id') or f'material-{index + 1}').strip()
        if material_id in seen_material_ids:
            raise RuntimeError(f'Duplicate learning material id {material_id!r} in course {course_id}.')
        seen_material_ids.add(material_id)
        Material.objects.create(
            course=course,
            material_id=material_id,
            order=index,
            title=str(raw_material.get('title') or f'Material {index + 1}'),
            material_type=str(raw_material.get('type') or 'Guide'),
            url=str(raw_material.get('url') or ''),
            file_name=str(raw_material.get('fileName') or ''),
            mime_type=str(raw_material.get('mimeType') or ''),
            description=str(raw_material.get('description') or ''),
        )

    return course


def backfill_simulation_data(apps, schema_editor):
    Catalog = apps.get_model('dashboard', 'SimulationCourseCatalog')
    Progress = apps.get_model('dashboard', 'SimulationProgress')
    Course = apps.get_model('dashboard', 'SimulationCourse')
    Objective = apps.get_model('dashboard', 'SimulationCourseObjective')
    Prerequisite = apps.get_model('dashboard', 'SimulationCoursePrerequisite')
    Lesson = apps.get_model('dashboard', 'SimulationLesson')
    Point = apps.get_model('dashboard', 'SimulationLessonPoint')
    ExamQuestion = apps.get_model('dashboard', 'SimulationLessonExamQuestion')
    ExamChoice = apps.get_model('dashboard', 'SimulationLessonExamChoice')
    Material = apps.get_model('dashboard', 'SimulationCourseMaterial')
    CourseProgress = apps.get_model('dashboard', 'SimulationCourseProgress')
    VideoCompletion = apps.get_model('dashboard', 'SimulationLessonVideoCompletion')
    Quiz = apps.get_model('dashboard', 'SimulationModuleQuiz')
    Certificate = apps.get_model('dashboard', 'SimulationCertificate')
    Attempt = apps.get_model('dashboard', 'SimulationQuizAttempt')
    Question = apps.get_model('dashboard', 'SimulationQuizQuestion')
    Choice = apps.get_model('dashboard', 'SimulationQuizChoice')
    Answer = apps.get_model('dashboard', 'SimulationQuizAnswer')

    for catalog in Catalog.objects.all():
        archived_courses = catalog.archived_courses or []
        active_courses = catalog.courses or []
        if not isinstance(archived_courses, list) or not isinstance(active_courses, list):
            raise RuntimeError(f'Cannot normalize catalog {catalog.key}: course collections must be arrays.')
        for raw in archived_courses:
            _copy_course(Course, Objective, Prerequisite, Lesson, Point, ExamQuestion, ExamChoice, Material, raw, True)
        for raw in active_courses:
            _copy_course(Course, Objective, Prerequisite, Lesson, Point, ExamQuestion, ExamChoice, Material, raw, False)

    for progress in Progress.objects.all():
        course_values = progress.course_progress or {}
        completed_values = progress.completed_courses or {}
        video_values = progress.completed_lesson_videos or {}
        if not all(isinstance(value, dict) for value in (course_values, completed_values, video_values)):
            raise RuntimeError(f'Cannot normalize non-object progress data for user {progress.user_id}.')

        course_ids = set(course_values) | set(completed_values)
        for course_id in course_ids:
            course = _ensure_course(Course, course_id)
            completed_at = None
            if course_id in completed_values:
                try:
                    completed_at = datetime.fromisoformat(str(completed_values[course_id]).replace('Z', '+00:00'))
                except ValueError as error:
                    raise RuntimeError(f'Invalid completion timestamp for course {course_id}: {error}') from error
                if timezone.is_naive(completed_at):
                    completed_at = timezone.make_aware(completed_at)
            try:
                completion_percentage = max(0, min(100, int(course_values.get(course_id, 0))))
            except (TypeError, ValueError):
                completion_percentage = 0
            CourseProgress.objects.create(
                progress=progress,
                course=course,
                completion_percentage=completion_percentage if course_id in course_values else None,
                completed_at=completed_at,
            )

        for key, is_completed in video_values.items():
            key = str(key)
            course_id, separator, lesson_id = key.partition(':')
            course = _ensure_course(Course, course_id)
            lesson = _ensure_lesson(Lesson, course, lesson_id) if separator and lesson_id else None
            VideoCompletion.objects.create(
                progress=progress,
                course=course,
                lesson=lesson,
                completion_key=key,
                is_completed=bool(is_completed),
            )

    for quiz in Quiz.objects.all():
        course = _ensure_course(Course, quiz.course_id)
        lesson = _ensure_lesson(Lesson, course, quiz.lesson_id)
        quiz.course_record = course
        quiz.lesson_record = lesson
        quiz.save(update_fields=['course_record', 'lesson_record'])

    for certificate in Certificate.objects.all():
        certificate.course_record = _ensure_course(Course, certificate.course_id)
        certificate.save(update_fields=['course_record'])

    for attempt in Attempt.objects.all():
        answers = attempt.answers or {}
        if not isinstance(answers, dict):
            raise RuntimeError(f'Cannot normalize answer data for attempt {attempt.pk}: answers must be an object.')
        for question_key, selected_choice_key in answers.items():
            question_key = str(question_key)
            try:
                question = Question.objects.get(pk=int(question_key), quiz_id=attempt.quiz_id)
            except (TypeError, ValueError, Question.DoesNotExist):
                question = None
            selected_choice = None
            choice_key = '' if selected_choice_key is None else str(selected_choice_key)
            if question is not None:
                try:
                    selected_choice = Choice.objects.get(pk=int(choice_key), question_id=question.pk)
                except (TypeError, ValueError, Choice.DoesNotExist):
                    pass
            Answer.objects.create(
                attempt=attempt,
                question=question,
                selected_choice=selected_choice,
                question_key=question_key,
                selected_choice_key='' if selected_choice else choice_key,
            )


def reverse_simulation_data(apps, schema_editor):
    Catalog = apps.get_model('dashboard', 'SimulationCourseCatalog')
    Progress = apps.get_model('dashboard', 'SimulationProgress')
    Course = apps.get_model('dashboard', 'SimulationCourse')
    Objective = apps.get_model('dashboard', 'SimulationCourseObjective')
    Prerequisite = apps.get_model('dashboard', 'SimulationCoursePrerequisite')
    Lesson = apps.get_model('dashboard', 'SimulationLesson')
    Point = apps.get_model('dashboard', 'SimulationLessonPoint')
    ExamQuestion = apps.get_model('dashboard', 'SimulationLessonExamQuestion')
    ExamChoice = apps.get_model('dashboard', 'SimulationLessonExamChoice')
    Material = apps.get_model('dashboard', 'SimulationCourseMaterial')
    CourseProgress = apps.get_model('dashboard', 'SimulationCourseProgress')
    VideoCompletion = apps.get_model('dashboard', 'SimulationLessonVideoCompletion')
    Quiz = apps.get_model('dashboard', 'SimulationModuleQuiz')
    Certificate = apps.get_model('dashboard', 'SimulationCertificate')
    Attempt = apps.get_model('dashboard', 'SimulationQuizAttempt')
    Answer = apps.get_model('dashboard', 'SimulationQuizAnswer')

    def serialize_course(course):
        return {
            'id': course.course_id,
            'title': course.title,
            'tag': course.tag,
            'difficulty': course.difficulty,
            'duration': course.duration,
            'description': course.description,
            'audience': course.audience,
            'objectives': list(Objective.objects.filter(course_id=course.pk).order_by('order').values_list('text', flat=True)),
            'prerequisites': list(Prerequisite.objects.filter(course_id=course.pk).order_by('order').values_list('text', flat=True)),
            'accent': course.accent,
            'heroImageUrl': course.hero_image_url,
            'heroImageName': course.hero_image_name,
            'lessonOutline': [
                {
                    'id': lesson.lesson_id,
                    'lessonType': lesson.lesson_type,
                    'title': lesson.title,
                    'duration': lesson.duration,
                    'videoUrl': lesson.video_url,
                    'videoFileName': lesson.video_file_name,
                    'summary': lesson.summary,
                    'points': list(Point.objects.filter(lesson_id=lesson.pk).order_by('order').values_list('text', flat=True)),
                    'content': lesson.content,
                    'examQuestions': [
                        {
                            'id': question.question_id,
                            'prompt': question.prompt,
                            'options': list(ExamChoice.objects.filter(question_id=question.pk).order_by('order').values_list('text', flat=True)),
                            'correctOptionIndex': next(
                                (index for index, choice in enumerate(ExamChoice.objects.filter(question_id=question.pk).order_by('order')) if choice.is_correct),
                                0,
                            ),
                            'explanation': question.explanation,
                        }
                        for question in ExamQuestion.objects.filter(lesson_id=lesson.pk).order_by('order')
                    ],
                    'passingScore': lesson.passing_score,
                }
                for lesson in Lesson.objects.filter(course_id=course.pk, is_placeholder=False).order_by('order')
            ],
            'learningMaterials': [
                {
                    'id': material.material_id,
                    'title': material.title,
                    'type': material.material_type,
                    'url': material.url,
                    'fileName': material.file_name,
                    'mimeType': material.mime_type,
                    'description': material.description,
                }
                for material in Material.objects.filter(course_id=course.pk).order_by('order')
            ],
        }

    for catalog in Catalog.objects.all():
        catalog.courses = [
            serialize_course(course)
            for course in Course.objects.filter(is_archived=False, is_placeholder=False)
        ]
        catalog.archived_courses = [
            serialize_course(course)
            for course in Course.objects.filter(is_archived=True, is_placeholder=False)
        ]
        catalog.save(update_fields=['courses', 'archived_courses'])

    for progress in Progress.objects.all():
        course_progress = {}
        completed_courses = {}
        for row in CourseProgress.objects.filter(progress_id=progress.pk).select_related('course'):
            if row.completion_percentage is not None:
                course_progress[row.course_id] = row.completion_percentage
            if row.completed_at:
                completed_courses[row.course_id] = row.completed_at.isoformat()
        progress.course_progress = course_progress
        progress.completed_courses = completed_courses
        progress.completed_lesson_videos = {
            row.completion_key: row.is_completed
            for row in VideoCompletion.objects.filter(progress_id=progress.pk)
        }
        progress.save(update_fields=['course_progress', 'completed_courses', 'completed_lesson_videos'])

    for quiz in Quiz.objects.all():
        quiz.course_id = quiz.course_record_id
        quiz.lesson_id = quiz.lesson_record.lesson_id
        quiz.save(update_fields=['course_id', 'lesson_id'])

    for certificate in Certificate.objects.all():
        certificate.course_id = certificate.course_record_id
        certificate.save(update_fields=['course_id'])

    for attempt in Attempt.objects.all():
        answers = {}
        for answer in Answer.objects.filter(attempt_id=attempt.pk):
            selected = answer.selected_choice_id
            if selected is None:
                selected = answer.selected_choice_key
                if selected.isdigit():
                    selected = int(selected)
            if selected != '':
                answers[answer.question_key] = selected
        attempt.answers = answers
        attempt.save(update_fields=['answers'])


class Migration(migrations.Migration):

    dependencies = [
        ('dashboard', '0006_simulationcourse_simulationcoursematerial_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='simulationmodulequiz',
            name='course_id',
            field=models.CharField(db_index=True, max_length=120, null=True),
        ),
        migrations.AlterField(
            model_name='simulationmodulequiz',
            name='lesson_id',
            field=models.CharField(db_index=True, max_length=120, null=True),
        ),
        migrations.AlterField(
            model_name='simulationcertificate',
            name='course_id',
            field=models.CharField(db_index=True, max_length=120, null=True),
        ),
        migrations.RunPython(backfill_simulation_data, reverse_simulation_data),
        migrations.RemoveField(model_name='simulationcoursecatalog', name='archived_courses'),
        migrations.RemoveField(model_name='simulationcoursecatalog', name='courses'),
        migrations.RemoveField(model_name='simulationprogress', name='completed_courses'),
        migrations.RemoveField(model_name='simulationprogress', name='completed_lesson_videos'),
        migrations.RemoveField(model_name='simulationprogress', name='course_progress'),
        migrations.RemoveField(model_name='simulationquizattempt', name='answers'),
        migrations.RemoveField(model_name='simulationmodulequiz', name='course_id'),
        migrations.RemoveField(model_name='simulationmodulequiz', name='lesson_id'),
        migrations.RemoveField(model_name='simulationcertificate', name='course_id'),
        migrations.AlterField(
            model_name='simulationcertificate',
            name='course_record',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='certificates', to='dashboard.simulationcourse'),
        ),
        migrations.AlterField(
            model_name='simulationmodulequiz',
            name='course_record',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='quizzes', to='dashboard.simulationcourse'),
        ),
        migrations.AlterField(
            model_name='simulationmodulequiz',
            name='lesson_record',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='quizzes', to='dashboard.simulationlesson'),
        ),
    ]
