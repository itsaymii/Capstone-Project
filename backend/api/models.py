from django.db import models


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
