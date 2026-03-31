from django.db import models
from django.contrib.auth.models import User


class SimulationProgress(models.Model):
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='simulation_progress')
	course_progress = models.JSONField(default=dict, blank=True)
	completed_lesson_videos = models.JSONField(default=dict, blank=True)
	completed_courses = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-updated_at']

	def __str__(self):
		return f"Simulation progress: {self.user.username}"
