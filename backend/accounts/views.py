import random
from datetime import timedelta
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.conf import settings
from django.db.models import Q
from django.utils.html import strip_tags
from django.utils import timezone
from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import AccountProfile, OneTimePassword, ensure_account_profile, get_user_role, user_bypasses_login_otp, user_has_dashboard_access


OTP_EXPIRY_MINUTES = 3
OTP_RESEND_COOLDOWN_SECONDS = 180
OTP_RECENT_LOGIN_BYPASS_MINUTES = 5


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


def _get_user_full_name(user: User) -> str:
	full_name = f"{user.first_name} {user.last_name}".strip()
	return full_name or user.username


def _serialize_user(user: User, fallback_identifier: str = '') -> dict:
	role = get_user_role(user)
	contact_value = (user.email or '').strip() or fallback_identifier or user.username
	return {
		'fullName': _get_user_full_name(user),
		'email': contact_value,
		'role': role,
		'isAdmin': role == AccountProfile.ROLE_ADMIN,
		'isStaff': role == AccountProfile.ROLE_STAFF,
		'hasDashboardAccess': user_has_dashboard_access(user),
	}


def _generate_otp_code() -> str:
	return ''.join(str(random.randint(0, 9)) for _ in range(6))


def _send_otp_email(email: str, code: str, purpose: str) -> None:
	action_label = (
		'registration'
		if purpose == OneTimePassword.PURPOSE_REGISTER
		else 'password reset'
		if purpose == OneTimePassword.PURPOSE_PASSWORD_RESET
		else 'login'
	)
	subject = getattr(settings, 'OTP_EMAIL_SUBJECT', 'Your DRMS OTP Code')
	body_template = getattr(
		settings,
		'OTP_EMAIL_BODY_TEMPLATE',
		'Your OTP code for {action_label} is: {otp_code}\n\nThis code expires in {expiry_minutes} minutes.',
	)
	# Support .env templates that use escaped newline sequences like "\\n".
	body_template = body_template.replace('\\n', '\n')
	message = body_template.format(
		action_label=action_label,
		otp_code=code,
		expiry_minutes=OTP_EXPIRY_MINUTES,
	)
	html_message = message if ('<' in message and '>' in message) else None
	plain_text_message = strip_tags(message) if html_message else message
	try:
		send_mail(
			subject=subject,
			message=plain_text_message,
			from_email=None,
			recipient_list=[email],
			html_message=html_message,
			fail_silently=False,
		)
	except Exception as exc:
		raise RuntimeError('Unable to send OTP email. Check SMTP email settings.') from exc


def _create_otp(email: str, purpose: str, payload: dict | None = None) -> str:
	code = _generate_otp_code()
	OneTimePassword.objects.create(
		email=email,
		purpose=purpose,
		code_hash=make_password(code),
		payload=payload or {},
		expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
	)
	return code


def _get_valid_otp(email: str, purpose: str) -> OneTimePassword | None:
	return (
		OneTimePassword.objects.filter(
			email__iexact=email,
			purpose=purpose,
			is_used=False,
			expires_at__gt=timezone.now(),
		)
		.order_by('-created_at')
		.first()
	)


def _get_recent_otp_request(email: str, purpose: str) -> OneTimePassword | None:
	return (
		OneTimePassword.objects.filter(
			email__iexact=email,
			purpose=purpose,
			created_at__gt=timezone.now() - timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS),
		)
		.order_by('-created_at')
		.first()
	)


def _get_retry_after_seconds(otp_record: OneTimePassword) -> int:
	elapsed_seconds = (timezone.now() - otp_record.created_at).total_seconds()
	remaining = OTP_RESEND_COOLDOWN_SECONDS - elapsed_seconds
	if remaining <= 0:
		return 0
	return int(remaining) + 1


def _is_encoded_password(password_value: str) -> bool:
	try:
		identify_hasher(password_value)
		return True
	except Exception:
		return False


def _has_recent_verified_login_otp(email: str, user_id: int) -> bool:
	recent_verified_otps = OneTimePassword.objects.filter(
		email__iexact=email,
		purpose=OneTimePassword.PURPOSE_LOGIN,
		is_used=True,
		created_at__gt=timezone.now() - timedelta(minutes=OTP_RECENT_LOGIN_BYPASS_MINUTES),
	).order_by('-created_at')

	for otp_record in recent_verified_otps:
		if otp_record.payload.get('userId') == user_id:
			return True

	return False


@api_view(['GET'])
def test_connection(request):
	return Response({'message': 'Backend connected successfully'})


@api_view(['POST'])
@csrf_exempt
@authentication_classes([])
@permission_classes([AllowAny])
def register_user(request):
	full_name = (request.data.get('fullName') or '').strip()
	email = (request.data.get('email') or '').strip().lower()
	username = (request.data.get('username') or '').strip().lower()
	password = request.data.get('password') or ''

	if not full_name or not email or not password:
		return Response({'error': 'Please fill in all required fields.'}, status=status.HTTP_400_BAD_REQUEST)

	try:
		validate_email(email)
	except ValidationError:
		return Response({'error': 'Please provide a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

	if len(password) < 6:
		return Response({'error': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

	if User.objects.filter(email__iexact=email).exists():
		return Response({'error': 'This email is already registered.'}, status=status.HTTP_400_BAD_REQUEST)

	if username and User.objects.filter(username__iexact=username).exists():
		return Response({'error': 'This username is already taken.'}, status=status.HTTP_400_BAD_REQUEST)

	recent_otp = _get_recent_otp_request(email=email, purpose=OneTimePassword.PURPOSE_REGISTER)
	if recent_otp:
		retry_after_seconds = _get_retry_after_seconds(recent_otp)
		return Response(
			{
				'error': f'Please wait {retry_after_seconds} seconds before requesting a new OTP.',
				'retryAfterSeconds': retry_after_seconds,
			},
			status=status.HTTP_429_TOO_MANY_REQUESTS,
		)

	otp_code = _create_otp(
		email=email,
		purpose=OneTimePassword.PURPOSE_REGISTER,
		payload={
			'fullName': full_name,
			'username': username,
			'passwordHash': make_password(password),
		},
	)

	try:
		_send_otp_email(email=email, code=otp_code, purpose=OneTimePassword.PURPOSE_REGISTER)
	except RuntimeError as exc:
		return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

	return Response({'message': 'OTP sent to your email for registration verification.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@csrf_exempt
@authentication_classes([])
@permission_classes([AllowAny])
def verify_register_otp(request):
	email = (request.data.get('email') or '').strip().lower()
	otp = (request.data.get('otp') or '').strip()

	if not email or not otp:
		return Response({'error': 'Email and OTP are required.'}, status=status.HTTP_400_BAD_REQUEST)

	otp_record = _get_valid_otp(email=email, purpose=OneTimePassword.PURPOSE_REGISTER)
	if not otp_record or not check_password(otp, otp_record.code_hash):
		return Response({'error': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)

	if User.objects.filter(email__iexact=email).exists():
		return Response({'error': 'This email is already registered.'}, status=status.HTTP_400_BAD_REQUEST)

	full_name = otp_record.payload.get('fullName', '')
	username = (otp_record.payload.get('username') or '').strip().lower()
	password_hash = otp_record.payload.get('passwordHash', '')

	if not full_name or not password_hash:
		return Response({'error': 'Registration payload is incomplete. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)

	if username and User.objects.filter(username__iexact=username).exists():
		return Response({'error': 'This username is already taken.'}, status=status.HTTP_400_BAD_REQUEST)

	resolved_username = username or email
	user = User.objects.create(username=resolved_username, email=email)
	user.first_name = full_name
	user.password = password_hash
	user.save()
	ensure_account_profile(user, default_role=AccountProfile.ROLE_CITIZEN)

	otp_record.is_used = True
	otp_record.save(update_fields=['is_used'])

	return Response(
		{
			'message': 'Registration successful! Welcome to Lucena City DRRMO. You can now log in using your verified account.',
			'user': {
				'fullName': user.first_name or user.username,
				'email': user.email,
			},
		},
		status=status.HTTP_201_CREATED,
	)


@api_view(['POST'])
@csrf_exempt
@authentication_classes([])
@permission_classes([AllowAny])
def login_user(request):
	identifier = (request.data.get('email') or request.data.get('identifier') or '').strip().lower()
	password = request.data.get('password') or ''
	force_otp = _coerce_bool(request.data.get('forceOtp'), default=True)

	if not identifier or not password:
		return Response({'error': 'Please enter your email/username and password.'}, status=status.HTTP_400_BAD_REQUEST)

	account = User.objects.filter(Q(email__iexact=identifier) | Q(username__iexact=identifier)).first()
	if not account:
		return Response({'error': 'Invalid email/username or password.'}, status=status.HTTP_400_BAD_REQUEST)

	user = authenticate(request, username=account.username, password=password)
	if not user and account.password and not _is_encoded_password(account.password):
		if account.password == password:
			account.set_password(password)
			account.save(update_fields=['password'])
			user = authenticate(request, username=account.username, password=password)

	if not user:
		return Response({'error': 'Invalid email/username or password.'}, status=status.HTTP_400_BAD_REQUEST)

	if not user.is_active:
		return Response({'error': 'This account is inactive.'}, status=status.HTTP_403_FORBIDDEN)

	if user_bypasses_login_otp(user):
		login(request, user)
		return Response(
			{
				'message': 'Login successful.',
				'skipOtp': True,
				'user': _serialize_user(user=user, fallback_identifier=identifier),
			},
			status=status.HTTP_200_OK,
		)

	if not force_otp:
		return Response({'error': 'OTP bypass is only allowed for staff and admin accounts.'}, status=status.HTTP_403_FORBIDDEN)

	if _has_recent_verified_login_otp(email=account.email, user_id=user.id):
		login(request, user)
		return Response(
			{
				'message': 'Login successful.',
				'skipOtp': True,
				'user': _serialize_user(user=user, fallback_identifier=identifier),
			},
			status=status.HTTP_200_OK,
		)

	if not account.email:
		return Response(
			{'error': 'This account needs a valid email address before OTP login can be used.'},
			status=status.HTTP_400_BAD_REQUEST,
		)

	recent_otp = _get_recent_otp_request(email=account.email, purpose=OneTimePassword.PURPOSE_LOGIN)
	if recent_otp:
		retry_after_seconds = _get_retry_after_seconds(recent_otp)
		return Response(
			{
				'error': f'Please wait {retry_after_seconds} seconds before requesting a new OTP.',
				'retryAfterSeconds': retry_after_seconds,
			},
			status=status.HTTP_429_TOO_MANY_REQUESTS,
		)

	otp_code = _create_otp(
		email=account.email,
		purpose=OneTimePassword.PURPOSE_LOGIN,
		payload={'userId': user.id},
	)

	try:
		_send_otp_email(email=account.email, code=otp_code, purpose=OneTimePassword.PURPOSE_LOGIN)
	except RuntimeError as exc:
		return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

	return Response(
		{
			'message': 'OTP sent to your email for login verification.',
			'otpEmail': account.email,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@csrf_exempt
@authentication_classes([])
@permission_classes([AllowAny])
def verify_login_otp(request):
	email = (request.data.get('email') or '').strip().lower()
	otp = (request.data.get('otp') or '').strip()

	if not email or not otp:
		return Response({'error': 'Email and OTP are required.'}, status=status.HTTP_400_BAD_REQUEST)

	otp_record = _get_valid_otp(email=email, purpose=OneTimePassword.PURPOSE_LOGIN)
	if not otp_record or not check_password(otp, otp_record.code_hash):
		return Response({'error': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)

	user_id = otp_record.payload.get('userId')
	user = User.objects.filter(id=user_id).first() if user_id else User.objects.filter(email__iexact=email).first()
	if not user:
		return Response({'error': 'User account not found.'}, status=status.HTTP_400_BAD_REQUEST)

	otp_record.is_used = True
	otp_record.save(update_fields=['is_used'])
	login(request, user)

	return Response(
		{
			'message': 'Login successful.',
			'user': _serialize_user(user=user, fallback_identifier=email),
		}
	)


@api_view(['POST'])
@csrf_exempt
@authentication_classes([])
@permission_classes([AllowAny])
def request_password_reset(request):
	email = (request.data.get('email') or '').strip().lower()

	if not email:
		return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

	try:
		validate_email(email)
	except ValidationError:
		return Response({'error': 'Please provide a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

	account = User.objects.filter(email__iexact=email).first()
	if not account:
		return Response({'error': 'No account was found for that email address.'}, status=status.HTTP_404_NOT_FOUND)

	recent_otp = _get_recent_otp_request(email=email, purpose=OneTimePassword.PURPOSE_PASSWORD_RESET)
	if recent_otp:
		retry_after_seconds = _get_retry_after_seconds(recent_otp)
		return Response(
			{
				'error': f'Please wait {retry_after_seconds} seconds before requesting a new OTP.',
				'retryAfterSeconds': retry_after_seconds,
			},
			status=status.HTTP_429_TOO_MANY_REQUESTS,
		)

	otp_code = _create_otp(
		email=email,
		purpose=OneTimePassword.PURPOSE_PASSWORD_RESET,
		payload={'userId': account.id},
	)

	try:
		_send_otp_email(email=email, code=otp_code, purpose=OneTimePassword.PURPOSE_PASSWORD_RESET)
	except RuntimeError as exc:
		return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

	return Response(
		{
			'message': 'Password reset OTP sent to your email.',
			'otpEmail': email,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@csrf_exempt
@authentication_classes([])
@permission_classes([AllowAny])
def confirm_password_reset(request):
	email = (request.data.get('email') or '').strip().lower()
	otp = (request.data.get('otp') or '').strip()
	new_password = request.data.get('newPassword') or ''

	if not email or not otp or not new_password:
		return Response({'error': 'Email, OTP, and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

	if len(new_password) < 6:
		return Response({'error': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

	otp_record = _get_valid_otp(email=email, purpose=OneTimePassword.PURPOSE_PASSWORD_RESET)
	if not otp_record or not check_password(otp, otp_record.code_hash):
		return Response({'error': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)

	user_id = otp_record.payload.get('userId')
	user = User.objects.filter(id=user_id).first() if user_id else User.objects.filter(email__iexact=email).first()
	if not user:
		return Response({'error': 'User account not found.'}, status=status.HTTP_400_BAD_REQUEST)

	user.set_password(new_password)
	user.save(update_fields=['password'])

	otp_record.is_used = True
	otp_record.save(update_fields=['is_used'])

	return Response({'message': 'Password reset successful. You can now log in with your new password.'}, status=status.HTTP_200_OK)

