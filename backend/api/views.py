import random
from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.conf import settings
from django.db.models import Q
from django.utils.html import strip_tags
from django.utils import timezone
from django.contrib.auth.hashers import check_password, make_password
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import OneTimePassword


OTP_EXPIRY_MINUTES = 3
OTP_RESEND_COOLDOWN_SECONDS = 180
OTP_RECENT_LOGIN_BYPASS_MINUTES = 5


def _generate_otp_code() -> str:
	return ''.join(str(random.randint(0, 9)) for _ in range(6))


def _send_otp_email(email: str, code: str, purpose: str) -> None:
	action_label = 'registration' if purpose == OneTimePassword.PURPOSE_REGISTER else 'login'
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
def login_user(request):
	identifier = (request.data.get('email') or request.data.get('identifier') or '').strip().lower()
	password = request.data.get('password') or ''
	force_otp = bool(request.data.get('forceOtp'))

	if not identifier or not password:
		return Response({'error': 'Please enter your email/username and password.'}, status=status.HTTP_400_BAD_REQUEST)

	account = User.objects.filter(Q(email__iexact=identifier) | Q(username__iexact=identifier)).first()
	if not account:
		return Response({'error': 'Invalid email/username or password.'}, status=status.HTTP_400_BAD_REQUEST)

	user = authenticate(request, username=account.username, password=password)
	if not user:
		return Response({'error': 'Invalid email/username or password.'}, status=status.HTTP_400_BAD_REQUEST)

	if not force_otp and _has_recent_verified_login_otp(email=account.email, user_id=user.id):
		return Response(
			{
				'message': 'Login successful.',
				'skipOtp': True,
				'user': {
					'fullName': user.first_name or user.username,
					'email': user.email,
				},
			},
			status=status.HTTP_200_OK,
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

	return Response(
		{
			'message': 'Login successful.',
			'user': {
				'fullName': user.first_name or user.username,
				'email': user.email,
			},
		}
	)

