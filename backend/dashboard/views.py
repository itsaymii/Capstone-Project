from datetime import timedelta
import re
import secrets

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Max
from django.http import FileResponse
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from accounts.models import AccountProfile, OneTimePassword, ResidencyVerification, ensure_account_profile, get_user_role, user_has_dashboard_access
from incidents.teams import TEAM_NAMES, team_name
from .models import (
    SimulationCertificate,
    SimulationCourseCatalog,
    SimulationExamAttempt,
    SimulationModuleQuiz,
    SimulationProgress,
    SimulationQuizAnswer,
    SimulationQuizAttempt,
    SimulationQuizChoice,
    SimulationQuizQuestion,
)

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover - optional dependency guard
    PdfReader = None


class HasDashboardAdminAccess(BasePermission):
    """
    Admin accounts only. The admin dashboard (accounts, simulation management, summary) is
    admin-only in the frontend, and staff (responder) accounts must not be able to call it
    directly either, or they could promote themselves or delete other accounts.
    """
    def has_permission(self, request, view) -> bool:
        user = getattr(request, 'user', None)
        return bool(
            user
            and user.is_authenticated
            and get_user_role(user) == AccountProfile.ROLE_ADMIN
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


def _serialize_dashboard_user(user: User, request=None) -> dict:
    role = get_user_role(user)
    residency = ResidencyVerification.objects.filter(user=user).first()
    # The ID or bill is only served to admins through the API (see dashboard_account_residency_proof),
    # never from the public /media/ folder.
    proof_url = (
        reverse('admin-dashboard-account-residency-proof', args=[user.id])
        if residency and residency.proof_document else None
    )
    return {
        'id': user.id,
        'fullName': _get_user_full_name(user),
        'email': user.email,
        'username': user.username,
        'role': role,
        'isAdmin': role == AccountProfile.ROLE_ADMIN,
        'isStaff': role == AccountProfile.ROLE_STAFF,
        'team': getattr(getattr(user, 'account_profile', None), 'team', '') or None,
        'hasDashboardAccess': user_has_dashboard_access(user),
        'isActive': user.is_active,
        'dateJoined': timezone.localtime(user.date_joined).isoformat() if user.date_joined else None,
        'lastLogin': timezone.localtime(user.last_login).isoformat() if user.last_login else None,
        'residencyStatus': residency.status if residency else None,
        'barangay': residency.barangay_name if residency else None,
        'residentialAddress': residency.residential_address if residency else None,
        'residencyProofUrl': proof_url,
        'residencyProofName': residency.proof_document_name if residency else None,
        'residencyRejectionReason': residency.rejection_reason if residency else '',
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


def _account_team(raw_team: object, role: str) -> tuple[str, str | None]:
    """
    The team for an account: (team, error). Responders (staff) must be in Alpha, Bravo or Charlie,
    because every report they file is filed under it. Other roles have no team.
    """
    if role != AccountProfile.ROLE_STAFF:
        return '', None
    team = team_name(raw_team)
    if team not in TEAM_NAMES:
        return '', 'Choose the responder team: Alpha, Bravo or Charlie.'
    return team, None


def _save_profile(user: User, role: str, team: str) -> None:
    profile = ensure_account_profile(user, default_role=role)
    if profile.role != role or profile.team != team:
        profile.role = role
        profile.team = team
        profile.save(update_fields=['role', 'team', 'updated_at'])
    user.account_profile = profile  # the serializer reads the team from here


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


def _serialize_simulation_admin_metrics() -> dict:
    metrics: dict[str, dict[str, int]] = {}
    progress_ids: dict[str, set[int]] = {}
    completed_progress_ids: dict[str, set[int]] = {}

    for record in SimulationCourseProgress.objects.only(
        'progress_id', 'course_id', 'completed_at',
    ).iterator():
        progress_ids.setdefault(record.course_id, set()).add(record.progress_id)
        if record.completed_at:
            completed_progress_ids.setdefault(record.course_id, set()).add(record.progress_id)

    for course_id, trainees in progress_ids.items():
        metrics[course_id] = {
            'trainees': len(trainees),
            'completed': len(completed_progress_ids.get(course_id, set())),
            'completionRate': 0,
        }

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
    seen_ids: set[str] = set()
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

        question_id = str(raw_question.get('id') or f'question-{q_index + 1}').strip() or f'question-{q_index + 1}'
        if question_id in seen_ids:
            raise ValidationError(f'Duplicate exam question id detected: {question_id}')
        seen_ids.add(question_id)
        sanitized_questions.append(
            {
                'id': question_id,
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
    seen_ids: set[str] = set()
    for index, raw_lesson in enumerate(raw_lessons):
        if not isinstance(raw_lesson, dict):
            continue

        lesson_type = str(raw_lesson.get('lessonType') or 'video').strip()
        if lesson_type not in ALLOWED_LESSON_TYPES:
            lesson_type = 'video'

        lesson_id = str(raw_lesson.get('id') or f'lesson-{index + 1}').strip() or f'lesson-{index + 1}'
        if lesson_id in seen_ids:
            raise ValidationError(f'Duplicate lesson id detected: {lesson_id}')
        seen_ids.add(lesson_id)
        sanitized_lessons.append(
            {
                'id': lesson_id,
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
    seen_ids: set[str] = set()
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

        material_id = str(raw_material.get('id') or f'material-{index + 1}').strip() or f'material-{index + 1}'
        if material_id in seen_ids:
            raise ValidationError(f'Duplicate learning material id detected: {material_id}')
        seen_ids.add(material_id)
        sanitized_materials.append(
            {
                'id': material_id,
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


def _get_or_create_simulation_course(course_id: str) -> SimulationCourse:
    course, _ = SimulationCourse.objects.get_or_create(
        course_id=course_id,
        defaults={'title': f'Course {course_id}', 'is_archived': True, 'is_placeholder': True},
    )
    return course


def _get_or_create_simulation_lesson(course: SimulationCourse, lesson_id: str) -> SimulationLesson:
    lesson, _ = SimulationLesson.objects.get_or_create(
        course=course,
        lesson_id=lesson_id,
        defaults={'title': lesson_id or 'Lesson', 'is_placeholder': True},
    )
    return lesson


def _save_simulation_course(course_data: dict, archived: bool = False) -> SimulationCourse:
    course, _ = SimulationCourse.objects.update_or_create(
        course_id=course_data['id'],
        defaults={
            'title': course_data['title'],
            'tag': course_data['tag'],
            'difficulty': course_data['difficulty'],
            'duration': course_data['duration'],
            'description': course_data['description'],
            'audience': course_data['audience'],
            'accent': course_data['accent'],
            'hero_image_url': course_data['heroImageUrl'],
            'hero_image_name': course_data['heroImageName'],
            'is_archived': archived,
            'is_placeholder': False,
        },
    )

    for model, values in (
        (SimulationCourseObjective, course_data['objectives']),
        (SimulationCoursePrerequisite, course_data['prerequisites']),
    ):
        model.objects.filter(course=course).delete()
        model.objects.bulk_create([model(course=course, order=index, text=text) for index, text in enumerate(values)])

    course.lessons.update(is_placeholder=True)
    for lesson_index, lesson_data in enumerate(course_data['lessonOutline']):
        lesson, _ = SimulationLesson.objects.get_or_create(
            course=course,
            lesson_id=lesson_data['id'],
            defaults={'title': lesson_data['title']},
        )
        for field, value in {
            'order': lesson_index,
            'lesson_type': lesson_data['lessonType'],
            'title': lesson_data['title'],
            'duration': lesson_data['duration'],
            'video_url': lesson_data['videoUrl'],
            'video_file_name': lesson_data['videoFileName'],
            'summary': lesson_data['summary'],
            'content': lesson_data['content'],
            'passing_score': lesson_data['passingScore'],
            'is_placeholder': False,
        }.items():
            setattr(lesson, field, value)
        lesson.save()

        lesson.points.all().delete()
        SimulationLessonPoint.objects.bulk_create(
            [SimulationLessonPoint(lesson=lesson, order=index, text=text) for index, text in enumerate(lesson_data['points'])]
        )

        lesson.exam_questions.all().delete()
        if lesson_data['lessonType'] == 'exam':
            for question_index, question_data in enumerate(lesson_data['examQuestions']):
                question = SimulationLessonExamQuestion.objects.create(
                    lesson=lesson,
                    question_id=question_data['id'],
                    order=question_index,
                    prompt=question_data['prompt'],
                    explanation=question_data['explanation'],
                )
                SimulationLessonExamChoice.objects.bulk_create([
                    SimulationLessonExamChoice(
                        question=question,
                        order=choice_index,
                        text=choice_text,
                        is_correct=choice_index == question_data['correctOptionIndex'],
                    )
                    for choice_index, choice_text in enumerate(question_data['options'])
                ])

    course.learning_materials.all().delete()
    SimulationCourseMaterial.objects.bulk_create([
        SimulationCourseMaterial(
            course=course,
            material_id=material['id'],
            order=index,
            title=material['title'],
            material_type=material['type'],
            url=material['url'],
            file_name=material['fileName'],
            mime_type=material['mimeType'],
            description=material['description'],
        )
        for index, material in enumerate(course_data['learningMaterials'])
    ])
    return course


def _serialize_simulation_course(course: SimulationCourse) -> dict:
    return {
        'id': course.course_id,
        'title': course.title,
        'tag': course.tag,
        'difficulty': course.difficulty,
        'duration': course.duration,
        'description': course.description,
        'audience': course.audience,
        'objectives': [item.text for item in course.objectives.all()],
        'prerequisites': [item.text for item in course.prerequisites.all()],
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
                'points': [point.text for point in lesson.points.all()],
                'content': lesson.content,
                'examQuestions': [
                    {
                        'id': question.question_id,
                        'prompt': question.prompt,
                        'options': [choice.text for choice in question.choices.all()],
                        'correctOptionIndex': next(
                            (index for index, choice in enumerate(question.choices.all()) if choice.is_correct),
                            0,
                        ),
                        'explanation': question.explanation,
                    }
                    for question in lesson.exam_questions.all()
                ],
                'passingScore': lesson.passing_score,
            }
            for lesson in course.lessons.filter(is_placeholder=False)
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
            for material in course.learning_materials.all()
        ],
    }


def _parse_progress_timestamp(value: str):
    timestamp = timezone.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if timezone.is_naive(timestamp):
        timestamp = timezone.make_aware(timestamp)
    return timestamp


def _save_simulation_progress(
    progress: SimulationProgress,
    course_progress: dict[str, int],
    completed_lesson_videos: dict[str, bool],
    completed_courses: dict[str, str],
) -> None:
    with transaction.atomic():
        progress.course_records.all().delete()
        progress.video_completions.all().delete()
        course_ids = set(course_progress) | set(completed_courses)
        for course_id in course_ids:
            course = _get_or_create_simulation_course(course_id)
            completed_at = _parse_progress_timestamp(completed_courses[course_id]) if course_id in completed_courses else None
            SimulationCourseProgress.objects.create(
                progress=progress,
                course=course,
                completion_percentage=course_progress.get(course_id),
                completed_at=completed_at,
            )

        for key, is_completed in completed_lesson_videos.items():
            course_id, separator, lesson_id = key.partition(':')
            course = _get_or_create_simulation_course(course_id)
            lesson = _get_or_create_simulation_lesson(course, lesson_id) if separator and lesson_id else None
            SimulationLessonVideoCompletion.objects.create(
                progress=progress,
                course=course,
                lesson=lesson,
                completion_key=key,
                is_completed=is_completed,
            )


def _serialize_simulation_progress(progress: SimulationProgress) -> dict:
    course_progress: dict[str, int] = {}
    completed_courses: dict[str, str] = {}
    for row in progress.course_records.select_related('course').all():
        if row.completion_percentage is not None:
            course_progress[row.course_id] = row.completion_percentage
        if row.completed_at:
            completed_courses[row.course_id] = timezone.localtime(row.completed_at).isoformat()

    return {
        'courseProgress': course_progress,
        'completedLessonVideos': {
            row.completion_key: row.is_completed
            for row in progress.video_completions.all()
        },
        'completedCourses': completed_courses,
        'updatedAt': timezone.localtime(progress.updated_at).isoformat() if progress.updated_at else None,
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
        'lessonId': quiz.lesson_record.lesson_id,
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
        'lessonId': quiz.lesson_record.lesson_id,
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


# Quizzes and exams: at most this many attempts per quiz in any 24 hours.
SIMULATION_MAX_ATTEMPTS = 3
SIMULATION_ATTEMPT_WINDOW = timedelta(hours=24)


def _get_catalog_courses() -> list[dict]:
    catalog = SimulationCourseCatalog.objects.filter(key='default').first()
    courses = catalog.courses if catalog and isinstance(catalog.courses, list) else []
    try:
        return _sanitize_simulation_courses(courses)
    except ValidationError:
        return []


def _find_catalog_course(course_id: str) -> dict | None:
    return next((course for course in _get_catalog_courses() if course['id'] == course_id), None)


def _hide_exam_answers(courses: list[dict]) -> list[dict]:
    """Learners get the exam questions without the correct answers; exams are graded on the server."""
    for course in courses:
        for lesson in course.get('lessonOutline', []):
            lesson['examQuestions'] = [
                {'id': question['id'], 'prompt': question['prompt'], 'options': question['options']}
                for question in lesson.get('examQuestions', [])
            ]
    return courses


def _attempt_limit(recent_attempts) -> tuple[int, int]:
    """(attempts left, seconds until the next attempt is allowed) for attempts on one quiz or exam."""
    window_start = timezone.now() - SIMULATION_ATTEMPT_WINDOW
    recent = list(recent_attempts.filter(attempted_at__gte=window_start).order_by('attempted_at').values_list('attempted_at', flat=True))
    attempts_left = max(0, SIMULATION_MAX_ATTEMPTS - len(recent))
    if attempts_left > 0:
        return attempts_left, 0
    retry_after = recent[0] + SIMULATION_ATTEMPT_WINDOW - timezone.now()
    return 0, max(1, int(retry_after.total_seconds()))


def _too_many_attempts(retry_after_seconds: int) -> Response:
    hours = max(1, round(retry_after_seconds / 3600))
    return Response(
        {
            'error': f'You have used all {SIMULATION_MAX_ATTEMPTS} attempts for the last 24 hours. Try again in about {hours} hour{"s" if hours != 1 else ""}.',
            'retryAfterSeconds': retry_after_seconds,
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _missing_course_requirements(user: User, course_id: str, course: dict | None) -> tuple[list[str], timezone.datetime | None]:
    """
    What the user still has to pass, checked on the server: every exam lesson of the course and
    every published module quiz of its lessons. Returns (titles still missing, time of the last pass).
    """
    missing: list[str] = []
    passed_times = []
    lesson_titles = {lesson['id']: lesson['title'] for lesson in (course or {}).get('lessonOutline', [])}

    for lesson in (course or {}).get('lessonOutline', []):
        if lesson['lessonType'] != 'exam' or not lesson['examQuestions']:
            continue
        last_pass = (
            SimulationExamAttempt.objects.filter(user=user, course_id=course_id, lesson_id=lesson['id'], passed=True)
            .order_by('-attempted_at')
            .first()
        )
        if last_pass:
            passed_times.append(last_pass.attempted_at)
        else:
            missing.append(f"{lesson['title']} (exam)")

    quiz_lessons = (
        SimulationModuleQuiz.objects.filter(course_id=course_id, status=SimulationModuleQuiz.STATUS_PUBLISHED)
        .values_list('lesson_id', 'lesson_title')
        .distinct()
    )
    checked_lessons = set()
    for lesson_id, lesson_title in quiz_lessons:
        if lesson_id in checked_lessons or (course and lesson_id not in lesson_titles):
            continue
        checked_lessons.add(lesson_id)
        last_pass = (
            SimulationQuizAttempt.objects.filter(user=user, quiz__course_id=course_id, quiz__lesson_id=lesson_id, passed=True)
            .order_by('-attempted_at')
            .first()
        )
        if last_pass:
            passed_times.append(last_pass.attempted_at)
        else:
            missing.append(f"{lesson_titles.get(lesson_id) or lesson_title or lesson_id} (module quiz)")

    return missing, max(passed_times) if passed_times else None


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

    _save_simulation_progress(progress, course_progress, completed_lesson_videos, completed_courses)
    progress.save(update_fields=['updated_at'])

    return Response(_serialize_simulation_progress(progress), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_metrics(request):
    return Response(_serialize_simulation_admin_metrics(), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def simulation_courses(request):
<<<<<<< HEAD
    catalog = SimulationCourseCatalog.objects.filter(key='default').first()
    courses = catalog.courses if catalog and isinstance(catalog.courses, list) else []

    try:
        sanitized_courses = _sanitize_simulation_courses(courses)
    except ValidationError:
        sanitized_courses = []

    # Admins edit the exams, so they need the answers; everyone else only gets the questions.
    if get_user_role(request.user) != AccountProfile.ROLE_ADMIN:
        sanitized_courses = _hide_exam_answers(sanitized_courses)

    return Response({'courses': sanitized_courses}, status=status.HTTP_200_OK)
=======
    courses = SimulationCourse.objects.filter(is_archived=False, is_placeholder=False).prefetch_related(
        'objectives',
        'prerequisites',
        'lessons__points',
        'lessons__exam_questions__choices',
        'learning_materials',
    )
    return Response({'courses': [_serialize_simulation_course(course) for course in courses]}, status=status.HTTP_200_OK)
>>>>>>> f1cb84bd463e4ad4338a1cdd47d0927e338c2e84


@api_view(['PUT'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_sync_courses(request):
    try:
        sanitized_courses = _sanitize_simulation_courses(request.data.get('courses'))
    except ValidationError as error:
        return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)

    catalog, _ = SimulationCourseCatalog.objects.get_or_create(key='default')
    new_course_ids = {course.get('id') for course in sanitized_courses}
    with transaction.atomic():
        SimulationCourse.objects.filter(
            is_archived=False,
            is_placeholder=False,
        ).exclude(course_id__in=new_course_ids).update(is_archived=True)
        courses = [_save_simulation_course(course) for course in sanitized_courses]
        catalog.updated_by = request.user
        catalog.save(update_fields=['updated_by', 'updated_at'])

    return Response({'courses': [_serialize_simulation_course(course) for course in courses]}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_archived_courses(request):
    courses = SimulationCourse.objects.filter(is_archived=True, is_placeholder=False).prefetch_related(
        'objectives',
        'prerequisites',
        'lessons__points',
        'lessons__exam_questions__choices',
        'learning_materials',
    )
    return Response({'courses': [_serialize_simulation_course(course) for course in courses]}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_restore_course(request):
    course_id = str(request.data.get('courseId') or '').strip()
    if not course_id:
        return Response({'error': 'courseId is required.'}, status=status.HTTP_400_BAD_REQUEST)

    restored_course = SimulationCourse.objects.filter(
        course_id=course_id,
        is_archived=True,
        is_placeholder=False,
    ).first()
    if not restored_course:
        return Response({'error': 'Archived course not found.'}, status=status.HTTP_404_NOT_FOUND)

    restored_course.is_archived = False
    restored_course.save(update_fields=['is_archived', 'updated_at'])
    catalog, _ = SimulationCourseCatalog.objects.get_or_create(key='default')
    catalog.updated_by = request.user
    catalog.save(update_fields=['updated_by', 'updated_at'])
    active_courses = SimulationCourse.objects.filter(is_archived=False, is_placeholder=False).prefetch_related(
        'objectives', 'prerequisites', 'lessons__points', 'lessons__exam_questions__choices', 'learning_materials',
    )
    archived_courses = SimulationCourse.objects.filter(is_archived=True, is_placeholder=False).prefetch_related(
        'objectives', 'prerequisites', 'lessons__points', 'lessons__exam_questions__choices', 'learning_materials',
    )
    return Response(
        {
            'courses': [_serialize_simulation_course(course) for course in active_courses],
            'archivedCourses': [_serialize_simulation_course(course) for course in archived_courses],
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_quiz_detail(request):
    course_id = (request.query_params.get('course_id') or '').strip()
    lesson_id = (request.query_params.get('lesson_id') or '').strip()

    if not course_id or not lesson_id:
        return Response({'error': 'course_id and lesson_id are required.'}, status=status.HTTP_400_BAD_REQUEST)

    quiz = (
        SimulationModuleQuiz.objects.filter(course_record_id=course_id, lesson_record__lesson_id=lesson_id)
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
        SimulationModuleQuiz.objects.filter(course_record_id=course_id, lesson_record__lesson_id=lesson_id).aggregate(max_version=Max('version')).get('max_version')
        or 0
    )

    course = _get_or_create_simulation_course(course_id)
    lesson = _get_or_create_simulation_lesson(course, lesson_id)
    quiz = SimulationModuleQuiz.objects.create(
        course_record=course,
        lesson_record=lesson,
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
            course_record_id=quiz.course_id,
            lesson_record__lesson_id=quiz.lesson_record.lesson_id,
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
            course_record_id=course_id,
            lesson_record__lesson_id=lesson_id,
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

    # An incomplete answer sheet is not graded and does not use up an attempt.
    unanswered_count = sum(1 for question in questions if raw_answers.get(str(question.id)) in (None, ''))
    if unanswered_count:
        return Response(
            {'error': f'Answer all questions first. {unanswered_count} remaining.', 'unanswered': unanswered_count},
            status=status.HTTP_400_BAD_REQUEST,
        )

    attempts_left, retry_after = _attempt_limit(
        SimulationQuizAttempt.objects.filter(user=request.user, quiz__course_id=quiz.course_id, quiz__lesson_id=quiz.lesson_id)
    )
    if attempts_left == 0:
        return _too_many_attempts(retry_after)

    correct_count = 0
    unanswered = 0
    details = []
    answer_records: list[SimulationQuizAnswer] = []

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
            selected_choice = next((choice for choice in choices if choice.id == selected_choice_id), None)
            answer_records.append(
                SimulationQuizAnswer(
                    question=question,
                    question_key=question_key,
                    selected_choice=selected_choice,
                    selected_choice_key='' if selected_choice else str(selected_choice_id),
                )
            )

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

    attempt = SimulationQuizAttempt.objects.create(
        user=request.user,
        quiz=quiz,
        score=score,
        total_questions=total_questions,
        passed=passed,
        unanswered=unanswered,
    )
    for answer in answer_records:
        answer.attempt = attempt
    SimulationQuizAnswer.objects.bulk_create(answer_records)

    if passed:
        progress, _ = SimulationProgress.objects.get_or_create(user=request.user)
        completion_key = f'{quiz.course_id}:{quiz.lesson_record.lesson_id}'
        SimulationLessonVideoCompletion.objects.update_or_create(
            progress=progress,
            completion_key=completion_key,
            defaults={
                'course': quiz.course_record,
                'lesson': quiz.lesson_record,
                'is_completed': True,
            },
        )
        progress.save(update_fields=['updated_at'])

    return Response(
        {
            'score': score,
            'totalQuestions': total_questions,
            'passed': passed,
            'unanswered': unanswered,
            'requiredScore': quiz.passing_score,
            # The answers are only shown after passing, so a failed attempt does not give them away.
            'details': details if passed else [],
            'attemptsLeft': attempts_left - 1,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def simulation_submit_exam_attempt(request):
    """Grade an exam lesson from the course catalog on the server (learners never get the answers)."""
    course_id = str(request.data.get('courseId') or '').strip()
    lesson_id = str(request.data.get('lessonId') or '').strip()
    raw_answers = request.data.get('answers')

    if not course_id or not lesson_id:
        return Response({'error': 'courseId and lessonId are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(raw_answers, dict):
        return Response({'error': 'answers must be an object keyed by question id.'}, status=status.HTTP_400_BAD_REQUEST)

    course = _find_catalog_course(course_id)
    lesson = next((item for item in (course or {}).get('lessonOutline', []) if item['id'] == lesson_id), None)
    if not lesson or lesson['lessonType'] != 'exam' or not lesson['examQuestions']:
        return Response({'error': 'Exam not found.'}, status=status.HTTP_404_NOT_FOUND)

    questions = lesson['examQuestions']
    answers: dict[str, int] = {}
    for question in questions:
        try:
            answers[question['id']] = int(raw_answers.get(question['id']))
        except (TypeError, ValueError):
            continue

    unanswered = len(questions) - len(answers)
    if unanswered:
        return Response(
            {'error': f'Answer all questions first. {unanswered} remaining.', 'unanswered': unanswered},
            status=status.HTTP_400_BAD_REQUEST,
        )

    attempts_left, retry_after = _attempt_limit(
        SimulationExamAttempt.objects.filter(user=request.user, course_id=course_id, lesson_id=lesson_id)
    )
    if attempts_left == 0:
        return _too_many_attempts(retry_after)

    correct_count = sum(1 for question in questions if answers[question['id']] == question['correctOptionIndex'])
    score = round((correct_count / len(questions)) * 100)
    passed = score >= lesson['passingScore']

    SimulationExamAttempt.objects.create(
        user=request.user,
        course_id=course_id,
        lesson_id=lesson_id,
        answers=answers,
        score=score,
        total_questions=len(questions),
        passed=passed,
    )

    if passed:
        progress, _ = SimulationProgress.objects.get_or_create(user=request.user)
        completed_map = progress.completed_lesson_videos if isinstance(progress.completed_lesson_videos, dict) else {}
        completed_map[f'{course_id}:{lesson_id}'] = True
        progress.completed_lesson_videos = completed_map
        progress.save(update_fields=['completed_lesson_videos', 'updated_at'])

    details = [
        {
            'questionId': question['id'],
            'selectedOptionIndex': answers[question['id']],
            'correctOptionIndex': question['correctOptionIndex'],
            'isCorrect': answers[question['id']] == question['correctOptionIndex'],
            'explanation': question['explanation'],
        }
        for question in questions
    ]

    return Response(
        {
            'score': score,
            'totalQuestions': len(questions),
            'passed': passed,
            'unanswered': 0,
            'requiredScore': lesson['passingScore'],
            'details': details if passed else [],
            'attemptsLeft': attempts_left - 1,
        },
        status=status.HTTP_200_OK,
    )


def _generate_ticket_code() -> str:
    while True:
        code = f"TCKT-{secrets.token_hex(4).upper()}"
        if not SimulationCertificate.objects.filter(ticket_code=code).exists():
            return code


def _serialize_certificate(certificate: SimulationCertificate) -> dict:
    return {
        'id': certificate.id,
        'courseId': certificate.course_id,
        'courseTitle': certificate.course_title,
        'ticketCode': certificate.ticket_code,
        'certificateNumber': certificate.certificate_number,
        'status': certificate.status,
        'traineeName': _get_user_full_name(certificate.user),
        'traineeEmail': certificate.user.email,
        'issuedBy': _get_user_full_name(certificate.issued_by) if certificate.issued_by else None,
        'issuedAt': timezone.localtime(certificate.issued_at).isoformat() if certificate.issued_at else None,
        'completedAt': timezone.localtime(certificate.completed_at).isoformat() if certificate.completed_at else None,
        'rejectionReason': certificate.rejection_reason,
        'createdAt': timezone.localtime(certificate.created_at).isoformat() if certificate.created_at else None,
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def simulation_request_certificate(request):
    """Citizens request a training ticket once DRRMO training (the course) is fully completed."""
    course_id = str(request.data.get('courseId') or '').strip()
    course_title = str(request.data.get('courseTitle') or '').strip()

    if not course_id:
        return Response({'error': 'courseId is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # The course must exist (once admins have published courses) and its title comes from the catalog.
    catalog_courses = _get_catalog_courses()
    course = next((item for item in catalog_courses if item['id'] == course_id), None)
    if catalog_courses and course is None:
        return Response({'error': 'This course is not available.'}, status=status.HTTP_404_NOT_FOUND)
    course_title = course['title'] if course else course_title[:255]

    progress, _ = SimulationProgress.objects.get_or_create(user=request.user)
    course_progress = progress.course_records.filter(course_id=course_id).first()
    if not course_progress or not course_progress.completed_at:
        return Response(
            {'error': 'Complete the DRRMO training course before requesting a training ticket.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

<<<<<<< HEAD
    # The browser only says the course is finished; the server checks every exam and quiz was passed.
    missing, last_passed_at = _missing_course_requirements(request.user, course_id, course)
    if missing:
        return Response(
            {'error': f"Pass these first: {', '.join(missing)}.", 'missing': missing},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if last_passed_at:
        completed_at = last_passed_at
    else:
        try:
            completed_at = timezone.datetime.fromisoformat(str(completed_at_raw).replace('Z', '+00:00'))
        except ValueError:
            completed_at = timezone.now()
=======
    completed_at = course_progress.completed_at
>>>>>>> f1cb84bd463e4ad4338a1cdd47d0927e338c2e84

    certificate, created = SimulationCertificate.objects.get_or_create(
        user=request.user,
        course_record_id=course_id,
        defaults={
            'course_record': _get_or_create_simulation_course(course_id),
            'course_title': course_title,
            'ticket_code': _generate_ticket_code(),
            'completed_at': completed_at,
        },
    )

    if not created:
        if course_title and certificate.course_title != course_title:
            certificate.course_title = course_title
        if certificate.status == SimulationCertificate.STATUS_REJECTED:
            certificate.status = SimulationCertificate.STATUS_PENDING
            certificate.rejection_reason = ''
        certificate.completed_at = completed_at
        certificate.save(update_fields=['course_title', 'status', 'rejection_reason', 'completed_at', 'updated_at'])

    return Response(_serialize_certificate(certificate), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def simulation_my_certificates(request):
    certificates = SimulationCertificate.objects.filter(user=request.user).select_related('issued_by')
    return Response({'certificates': [_serialize_certificate(certificate) for certificate in certificates]}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_certificates(request):
    status_filter = (request.query_params.get('status') or '').strip().lower()
    queryset = SimulationCertificate.objects.select_related('user', 'issued_by').all()

    if status_filter in dict(SimulationCertificate.STATUS_CHOICES):
        queryset = queryset.filter(status=status_filter)

    return Response({'certificates': [_serialize_certificate(certificate) for certificate in queryset]}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_issue_certificate(request, certificate_id: int):
    """DRRMO trainer/staff approves a training ticket, turning it into an official certificate."""
    certificate = SimulationCertificate.objects.filter(id=certificate_id).select_related('user').first()
    if not certificate:
        return Response({'error': 'Training ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    certificate.status = SimulationCertificate.STATUS_ISSUED
    certificate.issued_by = request.user
    certificate.issued_at = timezone.now()
    certificate.rejection_reason = ''
    if not certificate.certificate_number:
        certificate.certificate_number = f"DRRMO-{certificate.issued_at:%Y}-{certificate.id:05d}"
    certificate.save(update_fields=['status', 'issued_by', 'issued_at', 'certificate_number', 'rejection_reason', 'updated_at'])

    return Response(_serialize_certificate(certificate), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_reject_certificate(request, certificate_id: int):
    reason = str(request.data.get('reason') or '').strip()
    certificate = SimulationCertificate.objects.filter(id=certificate_id).first()
    if not certificate:
        return Response({'error': 'Training ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    certificate.status = SimulationCertificate.STATUS_REJECTED
    certificate.rejection_reason = reason or 'Not approved by the DRRMO trainer.'
    certificate.issued_by = None
    certificate.issued_at = None
    certificate.save(update_fields=['status', 'rejection_reason', 'issued_by', 'issued_at', 'updated_at'])

    return Response(_serialize_certificate(certificate), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([HasDashboardAdminAccess])
def simulation_admin_reset_progress(request):
    """Testing utility: clears course/quiz progress so trainees can retake modules."""
    user_id = request.data.get('userId')

    progress_qs = SimulationProgress.objects.all()
    attempts_qs = SimulationQuizAttempt.objects.all()
    exam_attempts_qs = SimulationExamAttempt.objects.all()
    certificates_qs = SimulationCertificate.objects.all()

    if user_id:
        progress_qs = progress_qs.filter(user_id=user_id)
        attempts_qs = attempts_qs.filter(user_id=user_id)
        exam_attempts_qs = exam_attempts_qs.filter(user_id=user_id)
        certificates_qs = certificates_qs.filter(user_id=user_id)

    reset_users = progress_qs.count()
<<<<<<< HEAD
    progress_qs.update(course_progress={}, completed_lesson_videos={}, completed_courses={})
    deleted_attempts, _ = attempts_qs.delete()
    deleted_exam_attempts, _ = exam_attempts_qs.delete()
    deleted_attempts += deleted_exam_attempts
=======
    for progress in progress_qs:
        progress.course_records.all().delete()
        progress.video_completions.all().delete()
    deleted_attempt_count = attempts_qs.count()
    attempts_qs.delete()
>>>>>>> f1cb84bd463e4ad4338a1cdd47d0927e338c2e84
    deleted_certificates, _ = certificates_qs.delete()

    return Response(
        {
            'resetUsers': reset_users,
            'deletedAttempts': deleted_attempt_count,
            'deletedCertificates': deleted_certificates,
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

    team, team_error = _account_team(request.data.get('team'), role)
    if team_error:
        return Response({'error': team_error}, status=status.HTTP_400_BAD_REQUEST)

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
    _save_profile(user, role, team)

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
    return Response({'users': [_serialize_dashboard_user(user, request) for user in users]})


@api_view(['PATCH'])
@permission_classes([HasDashboardAdminAccess])
def dashboard_account_residency_verification(request, user_id: int):
    user = User.objects.filter(id=user_id).first()
    if not user:
        return Response({'error': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

    residency = ResidencyVerification.objects.filter(user=user).first()
    if not residency:
        return Response({'error': 'This user has no residency verification request.'}, status=status.HTTP_404_NOT_FOUND)

    decision = (request.data.get('status') or '').strip().lower()
    if decision not in {ResidencyVerification.STATUS_VERIFIED, ResidencyVerification.STATUS_REJECTED}:
        return Response({'error': 'status must be verified or rejected.'}, status=status.HTTP_400_BAD_REQUEST)

    rejection_reason = (request.data.get('rejectionReason') or '').strip()
    if decision == ResidencyVerification.STATUS_REJECTED and not rejection_reason:
        return Response({'error': 'Provide a rejection reason before rejecting residency verification.'}, status=status.HTTP_400_BAD_REQUEST)

    residency.status = decision
    residency.rejection_reason = rejection_reason if decision == ResidencyVerification.STATUS_REJECTED else ''
    residency.reviewed_by = request.user
    residency.reviewed_at = timezone.now()
    residency.save(update_fields=['status', 'rejection_reason', 'reviewed_by', 'reviewed_at', 'updated_at'])

    user.is_active = decision == ResidencyVerification.STATUS_VERIFIED
    user.save(update_fields=['is_active'])

    return Response(
        {
            'message': f'Residency verification marked as {decision}.',
            'user': _serialize_dashboard_user(user, request),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([HasDashboardAdminAccess])
def dashboard_account_residency_proof(request, user_id: int):
    """The residency proof image (ID or bill) a citizen uploaded when registering. Admins only."""
    residency = ResidencyVerification.objects.filter(user_id=user_id).first()
    if not residency or not residency.proof_document:
        return Response({'error': 'This account has no residency proof.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        document = residency.proof_document.open('rb')
    except FileNotFoundError:
        return Response({'error': 'The residency proof file is missing.'}, status=status.HTTP_404_NOT_FOUND)

    response = FileResponse(document, filename=residency.proof_document_name or None)
    # Personal document: no shared or browser caching, and never guessed as anything but an image.
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response


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

    team, team_error = _account_team(request.data.get('team'), role)
    if team_error:
        return Response({'error': team_error}, status=status.HTTP_400_BAD_REQUEST)

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
    _save_profile(user, role, team)

    return Response(
        {
            'message': 'Account updated successfully.',
            'user': _serialize_dashboard_user(user),
        },
        status=status.HTTP_200_OK,
    )
