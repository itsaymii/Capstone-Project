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


class SimulationModuleQuiz(models.Model):
	STATUS_DRAFT = 'draft'
	STATUS_PUBLISHED = 'published'
	STATUS_ARCHIVED = 'archived'
	STATUS_CHOICES = [
		(STATUS_DRAFT, 'Draft'),
		(STATUS_PUBLISHED, 'Published'),
		(STATUS_ARCHIVED, 'Archived'),
	]

	course_id = models.CharField(max_length=120, db_index=True)
	lesson_id = models.CharField(max_length=120, db_index=True)
	lesson_title = models.CharField(max_length=255, blank=True)
	title = models.CharField(max_length=255)
	passing_score = models.PositiveSmallIntegerField(default=80)
	version = models.PositiveIntegerField(default=1)
	status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
	source_pdf = models.FileField(upload_to='simulation_quiz_pdfs/', blank=True, null=True)
	source_pdf_name = models.CharField(max_length=255, blank=True)
	parse_confidence = models.DecimalField(max_digits=5, decimal_places=2, default=0)
	parse_notes = models.TextField(blank=True)
	created_by = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name='created_simulation_quizzes')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-updated_at', '-id']
		indexes = [
			models.Index(fields=['course_id', 'lesson_id', 'status']),
		]

	def __str__(self):
		return f"{self.course_id}:{self.lesson_id} v{self.version} ({self.status})"


class SimulationQuizQuestion(models.Model):
	quiz = models.ForeignKey(SimulationModuleQuiz, on_delete=models.CASCADE, related_name='questions')
	order = models.PositiveIntegerField(default=0)
	prompt = models.TextField()
	explanation = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['order', 'id']

	def __str__(self):
		return f"Quiz {self.quiz_id} - Q{self.order + 1}"


class SimulationQuizChoice(models.Model):
	question = models.ForeignKey(SimulationQuizQuestion, on_delete=models.CASCADE, related_name='choices')
	order = models.PositiveIntegerField(default=0)
	text = models.TextField()
	is_correct = models.BooleanField(default=False)

	class Meta:
		ordering = ['order', 'id']

	def __str__(self):
		return f"Question {self.question_id} - Choice {self.order + 1}"


class SimulationQuizAttempt(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='simulation_quiz_attempts')
	quiz = models.ForeignKey(SimulationModuleQuiz, on_delete=models.CASCADE, related_name='attempts')
	answers = models.JSONField(default=dict, blank=True)
	score = models.PositiveSmallIntegerField(default=0)
	total_questions = models.PositiveSmallIntegerField(default=0)
	passed = models.BooleanField(default=False)
	unanswered = models.PositiveSmallIntegerField(default=0)
	attempted_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-attempted_at', '-id']
		indexes = [
			models.Index(fields=['user', 'quiz', 'attempted_at']),
		]

	def __str__(self):
		return f"Attempt {self.user_id} - quiz {self.quiz_id} ({self.score}%)"


class SimulationCourseCatalog(models.Model):
	key = models.CharField(max_length=64, unique=True, default='default')
	courses = models.JSONField(default=list, blank=True)
	archived_courses = models.JSONField(default=list, blank=True)
	updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name='updated_simulation_course_catalogs')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-updated_at', '-id']

	def __str__(self):
		return f"Simulation course catalog ({self.key})"


class SimulationCertificate(models.Model):
	"""Training ticket issued on course completion; becomes an official certificate once a DRRMO trainer approves it."""

	STATUS_PENDING = 'pending'
	STATUS_ISSUED = 'issued'
	STATUS_REJECTED = 'rejected'
	STATUS_CHOICES = [
		(STATUS_PENDING, 'Pending Review'),
		(STATUS_ISSUED, 'Issued'),
		(STATUS_REJECTED, 'Rejected'),
	]

	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='simulation_certificates')
	course_id = models.CharField(max_length=120, db_index=True)
	course_title = models.CharField(max_length=255, blank=True)
	ticket_code = models.CharField(max_length=32, unique=True)
	certificate_number = models.CharField(max_length=32, blank=True)
	status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
	issued_by = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name='issued_simulation_certificates')
	issued_at = models.DateTimeField(blank=True, null=True)
	rejection_reason = models.CharField(max_length=255, blank=True)
	completed_at = models.DateTimeField(blank=True, null=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-created_at', '-id']
		unique_together = ('user', 'course_id')
		indexes = [
			models.Index(fields=['status']),
		]

	def __str__(self):
		return f"{self.user.username} - {self.course_id} ({self.status})"
