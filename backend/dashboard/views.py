from datetime import timedelta

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from accounts.models import OneTimePassword
from .models import SimulationProgress


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
    return {
        'id': user.id,
        'fullName': _get_user_full_name(user),
        'email': user.email,
        'username': user.username,
        'isAdmin': bool(user.is_staff or user.is_superuser),
        'isActive': user.is_active,
        'dateJoined': timezone.localtime(user.date_joined).isoformat() if user.date_joined else None,
        'lastLogin': timezone.localtime(user.last_login).isoformat() if user.last_login else None,
    }


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
@permission_classes([IsAdminUser])
def simulation_admin_metrics(request):
    return Response(_serialize_simulation_admin_metrics(), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminUser])
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
@permission_classes([IsAdminUser])
def create_dashboard_account(request):
    full_name = (request.data.get('fullName') or '').strip()
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password') or ''
    is_admin = bool(request.data.get('isAdmin'))

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
        is_staff=is_admin,
        is_superuser=False,
    )

    return Response(
        {
            'message': 'Account created successfully.',
            'user': _serialize_dashboard_user(user),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def list_dashboard_accounts(request):
    users = User.objects.order_by('-date_joined', '-id')
    return Response({'users': [_serialize_dashboard_user(user) for user in users]})


@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
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

    is_admin = bool(request.data.get('isAdmin'))
    is_active = bool(request.data.get('isActive', True))

    if request.user.id == user.id and not is_admin:
        return Response({'error': 'You cannot remove your own admin access.'}, status=status.HTTP_400_BAD_REQUEST)

    user.first_name = full_name
    user.email = email
    user.username = username
    user.is_staff = is_admin
    user.is_active = is_active
    if password:
        user.set_password(password)
    user.save()

    return Response(
        {
            'message': 'Account updated successfully.',
            'user': _serialize_dashboard_user(user),
        },
        status=status.HTTP_200_OK,
    )
