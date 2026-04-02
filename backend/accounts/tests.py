from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse

from .models import AccountProfile, OneTimePassword, get_user_role


class AccountLoginFlowTests(TestCase):
	def test_citizen_login_requires_otp(self):
		citizen = User.objects.create_user(username='citizen-user', email='citizen@example.com', password='secret123')

		response = self.client.post(
			reverse('login-user'),
			data={'email': 'citizen@example.com', 'password': 'secret123'},
		)

		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertEqual(payload['message'], 'OTP sent to your email for login verification.')
		self.assertEqual(payload['otpEmail'], 'citizen@example.com')
		self.assertNotIn('user', payload)
		self.assertEqual(get_user_role(citizen), AccountProfile.ROLE_CITIZEN)

	def test_staff_login_bypasses_otp_on_unified_login(self):
		staff_user = User.objects.create_user(
			username='staff-user',
			email='staff@example.com',
			password='secret123',
			is_staff=True,
		)

		response = self.client.post(
			reverse('login-user'),
			data={'email': 'staff@example.com', 'password': 'secret123'},
		)

		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertTrue(payload['skipOtp'])
		self.assertEqual(payload['user']['role'], AccountProfile.ROLE_STAFF)
		self.assertFalse(payload['user']['isAdmin'])
		self.assertTrue(payload['user']['isStaff'])
		self.assertTrue(payload['user']['hasDashboardAccess'])
		self.assertEqual(get_user_role(staff_user), AccountProfile.ROLE_STAFF)

	def test_admin_role_login_bypasses_otp(self):
		admin_user = User.objects.create_user(
			username='ops-admin',
			email='admin@example.com',
			password='secret123',
			is_staff=True,
		)
		admin_user.account_profile.role = AccountProfile.ROLE_ADMIN
		admin_user.account_profile.save(update_fields=['role', 'updated_at'])

		response = self.client.post(
			reverse('login-user'),
			data={'email': 'admin@example.com', 'password': 'secret123'},
		)

		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertTrue(payload['skipOtp'])
		self.assertEqual(payload['user']['role'], AccountProfile.ROLE_ADMIN)
		self.assertTrue(payload['user']['isAdmin'])
		self.assertFalse(payload['user']['isStaff'])

	def test_new_users_receive_default_account_profile(self):
		user = User.objects.create_user(username='new-citizen', email='new@example.com', password='secret123')

		self.assertTrue(hasattr(user, 'account_profile'))
		self.assertEqual(user.account_profile.role, AccountProfile.ROLE_CITIZEN)

	def test_request_password_reset_sends_otp(self):
		User.objects.create_user(username='citizen-user', email='citizen@example.com', password='secret123')

		response = self.client.post(reverse('request-password-reset'), data={'email': 'citizen@example.com'})

		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertEqual(payload['message'], 'Password reset OTP sent to your email.')
		self.assertEqual(payload['otpEmail'], 'citizen@example.com')

	def test_confirm_password_reset_updates_password(self):
		user = User.objects.create_user(username='citizen-user', email='citizen@example.com', password='secret123')
		otp_record = OneTimePassword.objects.create(
			email='citizen@example.com',
			purpose=OneTimePassword.PURPOSE_PASSWORD_RESET,
			code_hash=make_password('123456'),
			payload={'userId': user.id},
			expires_at=timezone.now() + timedelta(minutes=3),
		)

		response = self.client.post(
			reverse('confirm-password-reset'),
			data={'email': 'citizen@example.com', 'otp': '123456', 'newPassword': 'newsecret123'},
		)

		self.assertEqual(response.status_code, 200)
		user.refresh_from_db()
		otp_record.refresh_from_db()
		self.assertTrue(user.check_password('newsecret123'))
		self.assertTrue(otp_record.is_used)
