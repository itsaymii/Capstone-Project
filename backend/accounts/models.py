from django.contrib.auth.models import User
from django.db import models
from django.db.utils import OperationalError, ProgrammingError
from django.db.models.signals import post_save
from django.dispatch import receiver


class OneTimePassword(models.Model):
	PURPOSE_REGISTER = 'register'
	PURPOSE_LOGIN = 'login'

	PURPOSE_CHOICES = [
		(PURPOSE_REGISTER, 'Register'),
		(PURPOSE_LOGIN, 'Login'),
	]

	email = models.EmailField(db_index=True)
	purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
	code_hash = models.CharField(max_length=128)
	payload = models.JSONField(default=dict, blank=True)
	expires_at = models.DateTimeField()
	is_used = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']

	def __str__(self):
		return f"{self.email} - {self.purpose}"


class AccountProfile(models.Model):
	ROLE_ADMIN = 'admin'
	ROLE_STAFF = 'staff'
	ROLE_CITIZEN = 'citizen'

	ROLE_CHOICES = [
		(ROLE_ADMIN, 'Admin'),
		(ROLE_STAFF, 'Staff'),
		(ROLE_CITIZEN, 'Citizen'),
	]

	DASHBOARD_ROLES = {ROLE_ADMIN, ROLE_STAFF}

	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='account_profile')
	role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_CITIZEN, db_index=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['user__username', 'user__id']

	def __str__(self):
		return f"{self.user.username} - {self.role}"

	@classmethod
	def derive_role_from_user(cls, user: User) -> str:
		if user.is_superuser:
			return cls.ROLE_ADMIN
		if user.is_staff:
			return cls.ROLE_STAFF
		return cls.ROLE_CITIZEN


def ensure_account_profile(user: User, default_role: str | None = None) -> AccountProfile:
	resolved_role = default_role or AccountProfile.derive_role_from_user(user)
	try:
		profile, created = AccountProfile.objects.get_or_create(
			user=user,
			defaults={'role': resolved_role},
		)
	except (OperationalError, ProgrammingError):
		return AccountProfile(user=user, role=resolved_role)

	if not created and profile.role not in dict(AccountProfile.ROLE_CHOICES):
		profile.role = resolved_role
		profile.save(update_fields=['role', 'updated_at'])

	return profile


def get_user_role(user: User) -> str:
	if user.is_superuser:
		return AccountProfile.ROLE_ADMIN

	try:
		profile = user.account_profile
	except (AccountProfile.DoesNotExist, OperationalError, ProgrammingError):
		return AccountProfile.derive_role_from_user(user)

	if profile.role in dict(AccountProfile.ROLE_CHOICES):
		return profile.role

	return AccountProfile.derive_role_from_user(user)


def user_has_dashboard_access(user: User) -> bool:
	return get_user_role(user) in AccountProfile.DASHBOARD_ROLES


def user_bypasses_login_otp(user: User) -> bool:
	return user_has_dashboard_access(user)


@receiver(post_save, sender=User)
def create_account_profile_for_new_user(sender, instance: User, created: bool, **kwargs):
	if created:
		try:
			ensure_account_profile(instance)
		except (OperationalError, ProgrammingError):
			return
