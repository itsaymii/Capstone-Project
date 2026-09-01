from datetime import timedelta
import re

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from accounts.models import AccountProfile, OneTimePassword, ensure_account_profile, get_user_role, user_has_dashboard_access
from .models import (
    SimulationCourseCatalog,
    SimulationModuleQuiz,
    SimulationProgress,
    SimulationQuizAttempt,
    SimulationQuizChoice,
    SimulationQuizQuestion,
)

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover - optional dependency guard
    PdfReader = None


class HasDashboardAdminAccess(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = getattr(request, 'user', None)
        return bool(
            user
            and user.is_authenticated
            and (
                user_has_dashboard_access(user)
                or getattr(user, 'is_staff', False)
                or getattr(user, 'is_superuser', False)
            )
        )


def _build_unique_username(seed: str) -> str:
    base = slugify(seed).replace('-', '')[:30] or 'user'
    username = base
    suffix = 1

    while User.objects.filter(username__iexact=username).exists():
        suffix_text = str(suffix)
        username = f"{base[: max(1, 30 - len(suffix_text))]}{suffix_text}"
        suffix += 1

    return username


def _get_user_full_name(user: User) -> str:
    full_name = f"{user.first_name} {user.last_name}".strip()
    return full_name or user.username


def _serialize_dashboard_user(user: User) -> dict:
    role = get_user_role(user)
    return {
        'id': user.id,
        'fullName': _get_user_full_name(user),
        'email': user.email,
        'username': user.username,
        'role': role,
        'isAdmin': role == AccountProfile.ROLE_ADMIN,
        'isStaff': role == AccountProfile.ROLE_STAFF,
        'hasDashboardAccess': user_has_dashboard_access(user),
        'isActive': user.is_active,
        'dateJoined': timezone.localtime(user.date_joined).isoformat() if user.date_joined else None,
        'lastLogin': timezone.localtime(user.last_login).isoformat() if user.last_login else None,
    }


def _coerce_bool(value, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return default

    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {'true', '1', 'yes', 'y', 'on'}:
            return True
        if normalized in {'false', '0', 'no', 'n', 'off', ''}:
            return False

    return bool(value)


def _normalize_account_role(raw_role: object, legacy_is_admin: object = None) -> str:
    if isinstance(raw_role, str):
        normalized_role = raw_role.strip().lower()
        if normalized_role in {AccountProfile.ROLE_ADMIN, AccountProfile.ROLE_STAFF, AccountProfile.ROLE_CITIZEN}:
            return normalized_role

    if _coerce_bool(legacy_is_admin):
        return AccountProfile.ROLE_ADMIN

    return AccountProfile.ROLE_CITIZEN


def _role_has_dashboard_access(role: str) -> bool:
    return role in AccountProfile.DASHBOARD_ROLES


def _sanitize_course_progress(raw: object) -> dict[str, int]:
    if raw is None:
        return {}

    if not isinstance(raw, dict):
        raise ValidationError('courseProgress must be an object.')

    sanitized: dict[str, int] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not key.strip():
            continue

        try:
            numeric_value = int(round(float(value)))
        except (TypeError, ValueError):
            continue

        sanitized[key] = max(0, min(100, numeric_value))

    return sanitized


def _sanitize_completed_videos(raw: object) -> dict[str, bool]:
    if raw is None:
        return {}

    if not isinstance(raw, dict):
        raise ValidationError('completedLessonVideos must be an object.')

    sanitized: dict[str, bool] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not key.strip():
            continue

        sanitized[key] = bool(value)

    return sanitized


def _sanitize_completed_courses(raw: object) -> dict[str, str]:
    if raw is None:
        return {}

    if not isinstance(raw, dict):
        raise ValidationError('completedCourses must be an object.')

    sanitized: dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not key.strip() or not isinstance(value, str):
            continue

        timestamp = value.strip()
        if not timestamp:
            continue

        try:
            timezone.datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            continue

        sanitized[key] = timestamp

    return sanitized


def _serialize_simulation_progress(progress: SimulationProgress) -> dict:
    return {
        'courseProgress': progress.course_progress,
        'completedLessonVideos': progress.completed_lesson_videos,
        'completedCourses': progress.completed_courses,
        'updatedAt': timezone.localtime(progress.updated_at).isoformat() if progress.updated_at else None,
    }


def _serialize_simulation_admin_metrics() -> dict:
    metrics: dict[str, dict[str, int]] = {}

    for progress in SimulationProgress.objects.all().iterator():
        course_progress = progress.course_progress if isinstance(progress.course_progress, dict) else {}
        completed_courses = progress.completed_courses if isinstance(progress.completed_courses, dict) else {}

        course_ids = {
            key.strip()
            for key in [*course_progress.keys(), *completed_courses.keys()]
            if isinstance(key, str) and key.strip()
        }

        for course_id in course_ids:
            course_metrics = metrics.setdefault(course_id, {'trainees': 0, 'completed': 0, 'completionRate': 0})
            course_metrics['trainees'] += 1
            if course_id in completed_courses:
                course_metrics['completed'] += 1

    for course_metrics in metrics.values():
        trainees = course_metrics['trainees']
        completed = course_metrics['completed']
        course_metrics['completionRate'] = round((completed / trainees) * 100) if trainees > 0 else 0

    return {'courses': metrics}


def _coerce_passing_score(raw_value: object, default: int = 80) -> int:
    try:
        value = int(round(float(raw_value)))
    except (TypeError, ValueError):
        return default

    return max(1, min(100, value))


ALLOWED_COURSE_DIFFICULTIES = {'Beginner', 'Intermediate', 'Advanced'}
ALLOWED_LESSON_TYPES = {'video', 'lesson', 'exam'}
ALLOWED_MATERIAL_TYPES = {'PDF', 'Guide', 'Checklist', 'Worksheet', 'External Link'}


def _sanitize_text_list(raw_value: object, fallback_prefix: str) -> list[str]:
    if not isinstance(raw_value, list):
        return []

    values: list[str] = []
    for index, value in enumerate(raw_value):
        text = str(value or '').strip()
        if text:
            values.append(text)
        elif fallback_prefix:
            values.append(f'{fallback_prefix} {index + 1}')

    return values


def _sanitize_exam_questions(raw_questions: object) -> list[dict]:
    if not isinstance(raw_questions, list):
        return []

    sanitized_questions: list[dict] = []
    for q_index, raw_question in enumerate(raw_questions):
        if not isinstance(raw_question, dict):
            continue

        prompt = str(raw_question.get('prompt') or '').strip() or f'Question {q_index + 1}'
        options = [str(option or '').strip() for option in (raw_question.get('options') or []) if str(option or '').strip()]
        if len(options) < 2:
            options = ['Option 1', 'Option 2']

        try:
            correct_option_index = int(raw_question.get('correctOptionIndex', 0))
        except (TypeError, ValueError):
            correct_option_index = 0

        sanitized_questions.append(
            {
                'id': str(raw_question.get('id') or f'question-{q_index + 1}').strip() or f'question-{q_index + 1}',
                'prompt': prompt,
                'options': options,
                'correctOptionIndex': max(0, min(correct_option_index, len(options) - 1)),
                'explanation': str(raw_question.get('explanation') or '').strip(),
            }
        )

    return sanitized_questions


def _sanitize_lessons(raw_lessons: object) -> list[dict]:
    if not isinstance(raw_lessons, list):
        return []

    sanitized_lessons: list[dict] = []
    for index, raw_lesson in enumerate(raw_lessons):
        if not isinstance(raw_lesson, dict):
            continue

        lesson_type = str(raw_lesson.get('lessonType') or 'video').strip()
        if lesson_type not in ALLOWED_LESSON_TYPES:
            lesson_type = 'video'

        sanitized_lessons.append(
            {
                'id': str(raw_lesson.get('id') or f'lesson-{index + 1}').strip() or f'lesson-{index + 1}',
                'lessonType': lesson_type,
                'title': str(raw_lesson.get('title') or '').strip() or f'Lesson {index + 1}',
                'duration': str(raw_lesson.get('duration') or '').strip() or '10 min',
                'videoUrl': str(raw_lesson.get('videoUrl') or '').strip(),
                'videoFileName': str(raw_lesson.get('videoFileName') or '').strip(),
                'summary': str(raw_lesson.get('summary') or '').strip(),
                'points': _sanitize_text_list(raw_lesson.get('points'), ''),
                'content': str(raw_lesson.get('content') or '').strip(),
                'examQuestions': _sanitize_exam_questions(raw_lesson.get('examQuestions')) if lesson_type == 'exam' else [],
                'passingScore': _coerce_passing_score(raw_lesson.get('passingScore'), default=70),
            }
        )

    return sanitized_lessons


def _sanitize_learning_materials(raw_materials: object) -> list[dict]:
    if not isinstance(raw_materials, list):
        return []

    sanitized_materials: list[dict] = []
    for index, raw_material in enumerate(raw_materials):
        if not isinstance(raw_material, dict):
            continue

        material_type = str(raw_material.get('type') or 'Guide').strip()
        if material_type not in ALLOWED_MATERIAL_TYPES:
            material_type = 'Guide'

        title = str(raw_material.get('title') or '').strip()
        url = str(raw_material.get('url') or '').strip()
        description = str(raw_material.get('description') or '').strip()
        file_name = str(raw_material.get('fileName') or '').strip()

        if not (title or url or description or file_name):
            continue

        sanitized_materials.append(
            {
                'id': str(raw_material.get('id') or f'material-{index + 1}').strip() or f'material-{index + 1}',
                'title': title or f'Material {index + 1}',
                'type': material_type,
                'url': url,
                'fileName': file_name,
                'mimeType': str(raw_material.get('mimeType') or '').strip(),
                'description': description,
            }
        )

    return sanitized_materials


def _sanitize_simulation_course(raw_course: object, index: int) -> dict:
    if not isinstance(raw_course, dict):
        raise ValidationError('Each course must be an object.')

    difficulty = str(raw_course.get('difficulty') or 'Beginner').strip()
    if difficulty not in ALLOWED_COURSE_DIFFICULTIES:
        difficulty = 'Beginner'

    lessons = _sanitize_lessons(raw_course.get('lessonOutline'))
    if len(lessons) == 0:
        lessons = [
            {
                'id': f'lesson-{index + 1}-1',
                'lessonType': 'video',
                'title': 'Lesson 1',
                'duration': '10 min',
                'videoUrl': '',
                'videoFileName': '',
                'summary': '',
                'points': [],
                'content': '',
                'examQuestions': [],
                'passingScore': 70,
            }
        ]

    return {
        'id': str(raw_course.get('id') or f'course-{index + 1}').strip() or f'course-{index + 1}',
        'title': str(raw_course.get('title') or '').strip() or f'Course {index + 1}',
        'tag': str(raw_course.get('tag') or '').strip() or 'Preparedness Training',
        'difficulty': difficulty,
        'duration': str(raw_course.get('duration') or '').strip() or '30 min',
        'description': str(raw_course.get('description') or '').strip(),
        'audience': str(raw_course.get('audience') or '').strip(),
        'objectives': _sanitize_text_list(raw_course.get('objectives'), ''),
        'prerequisites': _sanitize_text_list(raw_course.get('prerequisites'), ''),
        'accent': str(raw_course.get('accent') or '').strip() or '#0b2a57',
        'heroImageUrl': str(raw_course.get('heroImageUrl') or '').strip(),
        'heroImageName': str(raw_course.get('heroImageName') or '').strip(),
        'lessonOutline': lessons,
        'learningMaterials': _sanitize_learning_materials(raw_course.get('learningMaterials')),
    }


def _sanitize_simulation_courses(raw_courses: object) -> list[dict]:
    if not isinstance(raw_courses, list):
        raise ValidationError('courses must be an array.')

    sanitized_courses: list[dict] = []
    seen_ids: set[str] = set()

    for index, raw_course in enumerate(raw_courses):
        course = _sanitize_simulation_course(raw_course, index)
        if course['id'] in seen_ids:
            raise ValidationError(f"Duplicate course id detected: {course['id']}")
        seen_ids.add(course['id'])
        sanitized_courses.append(course)

    return sanitized_courses


def _extract_text_from_pdf(uploaded_pdf) -> str:
    if PdfReader is None:
        raise ValidationError('PDF parser dependency is not installed. Please install pypdf first.')

    try:
        uploaded_pdf.seek(0)
        reader = PdfReader(uploaded_pdf)
    except Exception as error:
        raise ValidationError(f'Unable to read PDF file: {error}')

    page_texts: list[str] = []
    for page in reader.pages:
        try:
            page_texts.append(page.extract_text() or '')
        except Exception:
            page_texts.append('')

    extracted = '\n'.join(page_texts).strip()
    if not extracted:
        raise ValidationError('No readable text found in PDF. Use a text-based PDF or OCR-scanned content.')

    return extracted


def _parse_questions_from_pdf_text(text: str) -> tuple[list[dict], float, str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    questions: list[dict] = []
    current: dict | None = None

    question_pattern = re.compile(r'^(?:(?:question|q)\s*)?(\d{1,3})[\).:\-\s]+(.+)$', re.IGNORECASE)
    choice_pattern = re.compile(r'^(?:[\(\[]?([A-Ha-h]|\d{1,2})[\)\].:\-\s]+|[-•])\s*(.+)$')
    answer_pattern = re.compile(r'^(?:answer|correct\s*answer|ans)\s*[:\-]\s*([A-Ha-h]|\d{1,2})\b', re.IGNORECASE)
    explanation_pattern = re.compile(r'^(?:explanation|rationale|reason)\s*[:\-]\s*(.+)$', re.IGNORECASE)

    def flush_current() -> None:
        nonlocal current
        if not current:
            return

        prompt = str(current.get('prompt') or '').strip()
        options = [str(option).strip() for option in current.get('options', []) if str(option).strip()]
        correct_option_index = current.get('correctOptionIndex')

        if prompt and len(options) >= 2:
            if not isinstance(correct_option_index, int) or correct_option_index < 0 or correct_option_index >= len(options):
                correct_option_index = 0

            questions.append({
                'prompt': prompt,
                'options': options,
                'correctOptionIndex': correct_option_index,
                'explanation': str(current.get('explanation') or '').strip(),
            })

        current = None

    for line in lines:
        question_match = question_pattern.match(line)
        if question_match:
            flush_current()
            current = {
                'prompt': question_match.group(2).strip(),
                'options': [],
                'correctOptionIndex': None,
                'explanation': '',
            }
            continue

        if current is None:
            continue

        choice_match = choice_pattern.match(line)
        if choice_match:
            token = choice_match.group(1)
            option_text = choice_match.group(2).strip()
            if option_text:
                current['options'].append(option_text)
                if current.get('correctOptionIndex') is None and token and token.isdigit() and len(current['options']) == 1:
                    current['correctOptionIndex'] = None
            continue

        answer_match = answer_pattern.match(line)
        if answer_match:
            token = answer_match.group(1).strip()
            if token.isdigit():
                current['correctOptionIndex'] = max(0, int(token) - 1)
            else:
                current['correctOptionIndex'] = max(0, ord(token.upper()) - ord('A'))
            continue

        explanation_match = explanation_pattern.match(line)
        if explanation_match:
            current['explanation'] = explanation_match.group(1).strip()
            continue

        # Keep multiline question statements intact until choices start.
        if isinstance(current.get('options'), list) and len(current['options']) == 0:
            current['prompt'] = f"{current['prompt']} {line}".strip()
            continue

        # Allow wrapped option text lines after a choice has started.
        if isinstance(current.get('options'), list) and len(current['options']) > 0:
            current['options'][-1] = f"{current['options'][-1]} {line}".strip()

    flush_current()

    if len(questions) == 0:
        return [], 0.0, 'No valid multiple-choice questions were detected. Use a text-based PDF with question numbers like 1., Question 1, or Q1, plus choices like A., B., C., D..'

    with_answer_count = sum(1 for question in questions if question['correctOptionIndex'] > -1)
    confidence = (with_answer_count / len(questions)) * 100
    notes = (
        'Questions parsed successfully.'
        if confidence >= 60
        else 'Questions parsed but several answers were unclear. Review before publishing.'
    )
    return questions, round(confidence, 2), notes


def _sanitize_quiz_questions(raw_questions: object) -> list[dict]:
    if not isinstance(raw_questions, list):
        raise ValidationError('questions must be an array.')

    sanitized: list[dict] = []
    for index, raw_question in enumerate(raw_questions):
        if not isinstance(raw_question, dict):
            continue

        prompt = str(raw_question.get('prompt') or '').strip()
        raw_options = raw_question.get('options')
        if not isinstance(raw_options, list):
            raw_options = []

        options = [str(option).strip() for option in raw_options if str(option).strip()]
        if not prompt or len(options) < 2:
            continue

        try:
            correct_option_index = int(raw_question.get('correctOptionIndex', 0))
        except (TypeError, ValueError):
            correct_option_index = 0

        correct_option_index = max(0, min(correct_option_index, len(options) - 1))

        sanitized.append({
            'prompt': prompt,
            'options': options,
            'correctOptionIndex': correct_option_index,
            'explanation': str(raw_question.get('explanation') or '').strip(),
            'order': index,
        })

    if len(sanitized) == 0:
        raise ValidationError('At least one valid question with 2 or more options is required.')

    return sanitized


def _replace_quiz_questions(quiz: SimulationModuleQuiz, sanitized_questions: list[dict]) -> None:
    with transaction.atomic():
        quiz.questions.all().delete()

        for question_data in sanitized_questions:
            question = SimulationQuizQuestion.objects.create(
                quiz=quiz,
                order=question_data['order'],
                prompt=question_data['prompt'],
                explanation=question_data['explanation'],
            )

            for option_index, option_text in enumerate(question_data['options']):
                SimulationQuizChoice.objects.create(
                    question=question,
                    order=option_index,
                    text=option_text,
                    is_correct=option_index == question_data['correctOptionIndex'],
                )


def _serialize_quiz_for_admin(quiz: SimulationModuleQuiz) -> dict:
    return {
        'id': quiz.id,
        'courseId': quiz.course_id,
        'lessonId': quiz.lesson_id,
        'lessonTitle': quiz.lesson_title,
        'title': quiz.title,
        'status': quiz.status,
        'version': quiz.version,
        'passingScore': quiz.passing_score,
        'sourcePdfName': quiz.source_pdf_name,
        'parseConfidence': float(quiz.parse_confidence),
        'parseNotes': quiz.parse_notes,
        'updatedAt': timezone.localtime(quiz.updated_at).isoformat() if quiz.updated_at else None,
        'questions': [
            {
                'id': question.id,
                'order': question.order,
                'prompt': question.prompt,
                'explanation': question.explanation,
                'options': [choice.text for choice in question.choices.all().order_by('order', 'id')],
                'correctOptionIndex': next(
                    (idx for idx, choice in enumerate(question.choices.all().order_by('order', 'id')) if choice.is_correct),
                    0,
                ),
            }
            for question in quiz.questions.all().order_by('order', 'id')
        ],
    }


def _serialize_quiz_for_learner(quiz: SimulationModuleQuiz) -> dict:
    return {
        'id': quiz.id,
        'courseId': quiz.course_id,
        'lessonId': quiz.lesson_id,
        'lessonTitle': quiz.lesson_title,
        'title': quiz.title,
        'version': quiz.version,
        'passingScore': quiz.passing_score,
        'questions': [
            {
                'id': question.id,
                'order': question.order,
                'prompt': question.prompt,
                'options': [
                    {
                        'id': choice.id,
                        'order': choice.order,
                        'text': choice.text,
                    }
                    for choice in question.choices.all().order_by('order', 'id')
                ],
            }
            for question in quiz.questions.all().order_by('order', 'id')
        ],
    }


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def simulation_progress(request):
    progress, _ = SimulationProgress.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        return Response(_serialize_simulation_progress(progress), status=status.HTTP_200_OK)

    try:
        course_progress = _sanitize_course_progress(request.data.get('courseProgress'))
        completed_lesson_videos = _sanitize_completed_videos(request.data.get('completedLessonVideos'))
        completed_courses = _sanitize_completed_courses(request.data.get('completedCourses'))
    except ValidationError as error:
        return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)

    progress.course_progress = course_progress
    progress.completed_lesson_videos = completed_lesson_videos
    progress.completed_courses = completed_courses
    progress.save(update_fields=['course_progress', 'completed_lesson_videos', 'completed_courses', 'updated_at'])

    return Response(_serialize_simulation_progress(progress), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_metrics(request):
    return Response(_serialize_simulation_admin_metrics(), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def simulation_courses(request):
    catalog = SimulationCourseCatalog.objects.filter(key='default').first()
    courses = catalog.courses if catalog and isinstance(catalog.courses, list) else []

    try:
        sanitized_courses = _sanitize_simulation_courses(courses)
    except ValidationError:
        sanitized_courses = []

    return Response({'courses': sanitized_courses}, status=status.HTTP_200_OK)


@api_view(['PUT'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_sync_courses(request):
    try:
        sanitized_courses = _sanitize_simulation_courses(request.data.get('courses'))
    except ValidationError as error:
        return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)

    catalog, _ = SimulationCourseCatalog.objects.get_or_create(key='default')
    catalog.courses = sanitized_courses
    catalog.updated_by = request.user
    catalog.save(update_fields=['courses', 'updated_by', 'updated_at'])

    return Response({'courses': sanitized_courses}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_quiz_detail(request):
    course_id = (request.query_params.get('course_id') or '').strip()
    lesson_id = (request.query_params.get('lesson_id') or '').strip()

    if not course_id or not lesson_id:
        return Response({'error': 'course_id and lesson_id are required.'}, status=status.HTTP_400_BAD_REQUEST)

    quiz = (
        SimulationModuleQuiz.objects.filter(course_id=course_id, lesson_id=lesson_id)
        .prefetch_related('questions__choices')
        .order_by('-version', '-updated_at')
        .first()
    )

    return Response({'quiz': _serialize_quiz_for_admin(quiz) if quiz else None}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_upload_quiz_pdf(request):
    course_id = (request.data.get('courseId') or '').strip()
    lesson_id = (request.data.get('lessonId') or '').strip()
    lesson_title = (request.data.get('lessonTitle') or '').strip()
    title = (request.data.get('title') or '').strip() or 'Module Quiz'
    passing_score = _coerce_passing_score(request.data.get('passingScore'), default=80)
    uploaded_pdf = request.FILES.get('pdf')

    if not course_id or not lesson_id:
        return Response({'error': 'courseId and lessonId are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not uploaded_pdf:
        return Response({'error': 'A PDF file is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not str(uploaded_pdf.name).lower().endswith('.pdf'):
        return Response({'error': 'Only PDF files are supported.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        text = _extract_text_from_pdf(uploaded_pdf)
        parsed_questions, parse_confidence, parse_notes = _parse_questions_from_pdf_text(text)
        sanitized_questions = _sanitize_quiz_questions(parsed_questions)
    except ValidationError as error:
        return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)

    current_max_version = (
        SimulationModuleQuiz.objects.filter(course_id=course_id, lesson_id=lesson_id).aggregate(max_version=Max('version')).get('max_version')
        or 0
    )

    quiz = SimulationModuleQuiz.objects.create(
        course_id=course_id,
        lesson_id=lesson_id,
        lesson_title=lesson_title,
        title=title,
        passing_score=passing_score,
        version=current_max_version + 1,
        status=SimulationModuleQuiz.STATUS_DRAFT,
        source_pdf=uploaded_pdf,
        source_pdf_name=uploaded_pdf.name,
        parse_confidence=parse_confidence,
        parse_notes=parse_notes,
        created_by=request.user,
    )

    _replace_quiz_questions(quiz, sanitized_questions)
    quiz.refresh_from_db()
    return Response({'quiz': _serialize_quiz_for_admin(quiz)}, status=status.HTTP_201_CREATED)


@api_view(['PUT'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_quiz_update(request, quiz_id: int):
    quiz = (
        SimulationModuleQuiz.objects.filter(id=quiz_id)
        .prefetch_related('questions__choices')
        .first()
    )
    if not quiz:
        return Response({'error': 'Quiz not found.'}, status=status.HTTP_404_NOT_FOUND)

    if quiz.status == SimulationModuleQuiz.STATUS_PUBLISHED:
        return Response({'error': 'Published quizzes cannot be edited. Create a new draft version.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        sanitized_questions = _sanitize_quiz_questions(request.data.get('questions'))
    except ValidationError as error:
        return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)

    quiz.title = (request.data.get('title') or quiz.title).strip() or quiz.title
    quiz.lesson_title = (request.data.get('lessonTitle') or quiz.lesson_title).strip()
    quiz.passing_score = _coerce_passing_score(request.data.get('passingScore'), default=quiz.passing_score)
    quiz.status = SimulationModuleQuiz.STATUS_DRAFT
    quiz.save(update_fields=['title', 'lesson_title', 'passing_score', 'status', 'updated_at'])

    _replace_quiz_questions(quiz, sanitized_questions)
    quiz.refresh_from_db()
    return Response({'quiz': _serialize_quiz_for_admin(quiz)}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_quiz_publish(request, quiz_id: int):
    quiz = SimulationModuleQuiz.objects.filter(id=quiz_id).prefetch_related('questions__choices').first()
    if not quiz:
        return Response({'error': 'Quiz not found.'}, status=status.HTTP_404_NOT_FOUND)

    questions = list(quiz.questions.all().order_by('order', 'id'))
    if len(questions) == 0:
        return Response({'error': 'Add at least one question before publishing.'}, status=status.HTTP_400_BAD_REQUEST)

    for question in questions:
        choices = list(question.choices.all().order_by('order', 'id'))
        if len(choices) < 2:
            return Response({'error': 'Every question needs at least 2 options before publishing.'}, status=status.HTTP_400_BAD_REQUEST)
        if not any(choice.is_correct for choice in choices):
            return Response({'error': 'Every question must have one correct answer before publishing.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        SimulationModuleQuiz.objects.filter(
            course_id=quiz.course_id,
            lesson_id=quiz.lesson_id,
            status=SimulationModuleQuiz.STATUS_PUBLISHED,
        ).exclude(id=quiz.id).update(status=SimulationModuleQuiz.STATUS_ARCHIVED)

        quiz.status = SimulationModuleQuiz.STATUS_PUBLISHED
        quiz.save(update_fields=['status', 'updated_at'])

    quiz.refresh_from_db()
    return Response({'quiz': _serialize_quiz_for_admin(quiz)}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def simulation_module_quiz(request):
    course_id = (request.query_params.get('course_id') or '').strip()
    lesson_id = (request.query_params.get('lesson_id') or '').strip()

    if not course_id or not lesson_id:
        return Response({'error': 'course_id and lesson_id are required.'}, status=status.HTTP_400_BAD_REQUEST)

    quiz = (
        SimulationModuleQuiz.objects.filter(
            course_id=course_id,
            lesson_id=lesson_id,
            status=SimulationModuleQuiz.STATUS_PUBLISHED,
        )
        .prefetch_related('questions__choices')
        .order_by('-version', '-updated_at')
        .first()
    )

    if not quiz:
        return Response({'quiz': None}, status=status.HTTP_200_OK)

    latest_attempt = SimulationQuizAttempt.objects.filter(user=request.user, quiz=quiz).order_by('-attempted_at').first()

    return Response(
        {
            'quiz': _serialize_quiz_for_learner(quiz),
            'latestAttempt': {
                'score': latest_attempt.score,
                'totalQuestions': latest_attempt.total_questions,
                'passed': latest_attempt.passed,
                'unanswered': latest_attempt.unanswered,
                'attemptedAt': timezone.localtime(latest_attempt.attempted_at).isoformat() if latest_attempt else None,
            }
            if latest_attempt
            else None,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def simulation_submit_quiz_attempt(request, quiz_id: int):
    quiz = (
        SimulationModuleQuiz.objects.filter(id=quiz_id, status=SimulationModuleQuiz.STATUS_PUBLISHED)
        .prefetch_related('questions__choices')
        .first()
    )
    if not quiz:
        return Response({'error': 'Published quiz not found.'}, status=status.HTTP_404_NOT_FOUND)

    raw_answers = request.data.get('answers')
    if not isinstance(raw_answers, dict):
        return Response({'error': 'answers must be an object keyed by question id.'}, status=status.HTTP_400_BAD_REQUEST)

    questions = list(quiz.questions.all().order_by('order', 'id'))
    total_questions = len(questions)
    if total_questions == 0:
        return Response({'error': 'This quiz has no questions.'}, status=status.HTTP_400_BAD_REQUEST)

    correct_count = 0
    unanswered = 0
    details = []
    normalized_answers: dict[str, int] = {}

    for question in questions:
        question_key = str(question.id)
        selected_choice_raw = raw_answers.get(question_key)
        selected_choice_id = None
        if selected_choice_raw is not None:
            try:
                selected_choice_id = int(selected_choice_raw)
            except (TypeError, ValueError):
                selected_choice_id = None

        choices = list(question.choices.all().order_by('order', 'id'))
        correct_choice = next((choice for choice in choices if choice.is_correct), None)

        if selected_choice_id is None:
            unanswered += 1
        elif correct_choice and selected_choice_id == correct_choice.id:
            correct_count += 1

        if selected_choice_id is not None:
            normalized_answers[question_key] = selected_choice_id

        details.append(
            {
                'questionId': question.id,
                'selectedChoiceId': selected_choice_id,
                'correctChoiceId': correct_choice.id if correct_choice else None,
                'isCorrect': bool(correct_choice and selected_choice_id == correct_choice.id),
                'explanation': question.explanation,
            }
        )

    score = round((correct_count / total_questions) * 100)
    passed = unanswered == 0 and score >= quiz.passing_score

    SimulationQuizAttempt.objects.create(
        user=request.user,
        quiz=quiz,
        answers=normalized_answers,
        score=score,
        total_questions=total_questions,
        passed=passed,
        unanswered=unanswered,
    )

    if passed:
        progress, _ = SimulationProgress.objects.get_or_create(user=request.user)
        completed_map = progress.completed_lesson_videos if isinstance(progress.completed_lesson_videos, dict) else {}
        completed_map[f'{quiz.course_id}:{quiz.lesson_id}'] = True
        progress.completed_lesson_videos = completed_map
        progress.save(update_fields=['completed_lesson_videos', 'updated_at'])

    return Response(
        {
            'score': score,
            'totalQuestions': total_questions,
            'passed': passed,
            'unanswered': unanswered,
            'requiredScore': quiz.passing_score,
            'details': details,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([HasDashboardAdminAccess])
def admin_dashboard_summary(request):
    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)

    response_data = {
        'summary': {
            'totalUsers': User.objects.count(),
            'totalAdminUsers': User.objects.filter(is_staff=True).count(),
            'activeUsersLast30Days': User.objects.filter(last_login__gte=thirty_days_ago).count(),
            'pendingOtps': OneTimePassword.objects.filter(is_used=False, expires_at__gt=now).count(),
            'verifiedOtpsToday': OneTimePassword.objects.filter(
                is_used=True,
                created_at__date=timezone.localdate(),
            ).count(),
        }
    }

    return Response(response_data)


@api_view(['POST'])
@permission_classes([HasDashboardAdminAccess])
def create_dashboard_account(request):
    full_name = (request.data.get('fullName') or '').strip()
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password') or ''
    role = _normalize_account_role(request.data.get('role'), request.data.get('isAdmin'))

    if not full_name or not email or not password:
        return Response({'error': 'Full name, email, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_email(email)
    except ValidationError:
        return Response({'error': 'Please provide a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 6:
        return Response({'error': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'This email is already in use.'}, status=status.HTTP_400_BAD_REQUEST)

    username_seed = request.data.get('username') or email.split('@', 1)[0] or full_name
    username = _build_unique_username(str(username_seed))

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=full_name,
        is_staff=_role_has_dashboard_access(role),
        is_superuser=False,
    )
    profile = ensure_account_profile(user, default_role=role)
    if profile.role != role:
        profile.role = role
        profile.save(update_fields=['role', 'updated_at'])

    return Response(
        {
            'message': 'Account created successfully.',
            'user': _serialize_dashboard_user(user),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([HasDashboardAdminAccess])
def list_dashboard_accounts(request):
    users = User.objects.order_by('-date_joined', '-id')
    return Response({'users': [_serialize_dashboard_user(user) for user in users]})


@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([HasDashboardAdminAccess])
def dashboard_account_detail(request, user_id: int):
    user = User.objects.filter(id=user_id).first()
    if not user:
        return Response({'error': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if request.user.id == user.id:
            return Response({'error': 'You cannot delete the account currently in use.'}, status=status.HTTP_400_BAD_REQUEST)

        user.delete()
        return Response({'message': 'Account deleted successfully.'}, status=status.HTTP_200_OK)

    full_name = (request.data.get('fullName') or '').strip()
    email = (request.data.get('email') or '').strip().lower()
    username = (request.data.get('username') or '').strip().lower()
    password = request.data.get('password') or ''

    if not full_name or not email or not username:
        return Response({'error': 'Full name, email, and username are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_email(email)
    except ValidationError:
        return Response({'error': 'Please provide a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(password) > 0 and len(password) < 6:
        return Response({'error': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=email).exclude(id=user.id).exists():
        return Response({'error': 'This email is already in use.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username__iexact=username).exclude(id=user.id).exists():
        return Response({'error': 'This username is already in use.'}, status=status.HTTP_400_BAD_REQUEST)

    role = _normalize_account_role(request.data.get('role'), request.data.get('isAdmin'))
    is_active = _coerce_bool(request.data.get('isActive', True), default=True)

    if request.user.id == user.id and not _role_has_dashboard_access(role):
        return Response({'error': 'You cannot remove your own dashboard access.'}, status=status.HTTP_400_BAD_REQUEST)

    user.first_name = full_name
    user.email = email
    user.username = username
    user.is_staff = _role_has_dashboard_access(role)
    user.is_active = is_active
    if password:
        user.set_password(password)
    user.save()
    profile = ensure_account_profile(user, default_role=role)
    if profile.role != role:
        profile.role = role
        profile.save(update_fields=['role', 'updated_at'])

    return Response(
        {
            'message': 'Account updated successfully.',
            'user': _serialize_dashboard_user(user),
        },
        status=status.HTTP_200_OK,
    )
