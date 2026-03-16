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


def _build_unique_username(seed: str) -> str:
    base = slugify(seed).replace('-', '')[:30] or 'user'
    username = base
    suffix = 1

    while User.objects.filter(username__iexact=username).exists():
        suffix_text = str(suffix)
        username = f"{base[: max(1, 30 - len(suffix_text))]}{suffix_text}"
        suffix += 1

    return username


@api_view(['GET'])
@permission_classes([IsAuthenticated])
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
            'user': {
                'fullName': user.first_name or user.username,
                'email': user.email,
                'isAdmin': user.is_staff,
            },
        },
        status=status.HTTP_201_CREATED,
    )
