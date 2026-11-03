from django.db import models
from django.contrib.auth.models import User


class SimulationProgress(models.Model):
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='simulation_progress')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-updated_at']

	def __str__(self):
		return f"Simulation progress: {self.user.username}"


class SimulationCourse(models.Model):
	course_id = models.TextField(primary_key=True)
	title = models.TextField()
	tag = models.TextField(default='Preparedness Training')
	difficulty = models.TextField(default='Beginner')
	duration = models.TextField(default='30 min')
	description = models.TextField(blank=True)
	audience = models.TextField(blank=True)
	accent = models.TextField(default='#0b2a57')
	hero_image_url = models.TextField(blank=True)
	hero_image_name = models.TextField(blank=True)
	is_archived = models.BooleanField(default=True, db_index=True)
	is_placeholder = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['title', 'course_id']

	def __str__(self):
		return self.title


class SimulationCourseObjective(models.Model):
	course = models.ForeignKey(SimulationCourse, on_delete=models.CASCADE, related_name='objectives')
	order = models.PositiveIntegerField(default=0)
	text = models.TextField()

	class Meta:
		ordering = ['order', 'id']
		constraints = [
			models.UniqueConstraint(fields=['course', 'order'], name='dashboard_course_objective_order_uniq'),
		]


class SimulationCoursePrerequisite(models.Model):
	course = models.ForeignKey(SimulationCourse, on_delete=models.CASCADE, related_name='prerequisites')
	order = models.PositiveIntegerField(default=0)
	text = models.TextField()

	class Meta:
		ordering = ['order', 'id']
		constraints = [
			models.UniqueConstraint(fields=['course', 'order'], name='dashboard_course_prereq_order_uniq'),
		]


class SimulationLesson(models.Model):
	course = models.ForeignKey(SimulationCourse, on_delete=models.CASCADE, related_name='lessons')
	lesson_id = models.TextField()
	order = models.PositiveIntegerField(default=0)
	lesson_type = models.CharField(max_length=12, default='video')
	title = models.TextField()
	duration = models.TextField(default='10 min')
	video_url = models.TextField(blank=True)
	video_file_name = models.TextField(blank=True)
	summary = models.TextField(blank=True)
	content = models.TextField(blank=True)
	passing_score = models.PositiveSmallIntegerField(default=70)
	is_placeholder = models.BooleanField(default=False)

	class Meta:
		ordering = ['order', 'id']
		constraints = [
			models.UniqueConstraint(fields=['course', 'lesson_id'], name='dashboard_course_lesson_id_uniq'),
		]

	def __str__(self):
		return f'{self.course_id}:{self.lesson_id}'


class SimulationLessonPoint(models.Model):
	lesson = models.ForeignKey(SimulationLesson, on_delete=models.CASCADE, related_name='points')
	order = models.PositiveIntegerField(default=0)
	text = models.TextField()

	class Meta:
		ordering = ['order', 'id']
		constraints = [
			models.UniqueConstraint(fields=['lesson', 'order'], name='dashboard_lesson_point_order_uniq'),
		]


class SimulationLessonExamQuestion(models.Model):
	lesson = models.ForeignKey(SimulationLesson, on_delete=models.CASCADE, related_name='exam_questions')
	question_id = models.TextField()
	order = models.PositiveIntegerField(default=0)
	prompt = models.TextField()
	explanation = models.TextField(blank=True)

	class Meta:
		ordering = ['order', 'id']
		constraints = [
			models.UniqueConstraint(fields=['lesson', 'question_id'], name='dashboard_lesson_exam_question_id_uniq'),
		]


class SimulationLessonExamChoice(models.Model):
	question = models.ForeignKey(SimulationLessonExamQuestion, on_delete=models.CASCADE, related_name='choices')
	order = models.PositiveIntegerField(default=0)
	text = models.TextField()
	is_correct = models.BooleanField(default=False)

	class Meta:
		ordering = ['order', 'id']
		constraints = [
			models.UniqueConstraint(fields=['question', 'order'], name='dashboard_exam_choice_order_uniq'),
		]


class SimulationCourseMaterial(models.Model):
	course = models.ForeignKey(SimulationCourse, on_delete=models.CASCADE, related_name='learning_materials')
	material_id = models.TextField()
	order = models.PositiveIntegerField(default=0)
	title = models.TextField()
	material_type = models.TextField(default='Guide')
	url = models.TextField(blank=True)
	file_name = models.TextField(blank=True)
	mime_type = models.TextField(blank=True)
	description = models.TextField(blank=True)

	class Meta:
		ordering = ['order', 'id']
		constraints = [
			models.UniqueConstraint(fields=['course', 'material_id'], name='dashboard_course_material_id_uniq'),
		]


class SimulationCourseProgress(models.Model):
	progress = models.ForeignKey(SimulationProgress, on_delete=models.CASCADE, related_name='course_records')
	course = models.ForeignKey(SimulationCourse, on_delete=models.PROTECT, related_name='progress_records')
	completion_percentage = models.PositiveSmallIntegerField(blank=True, null=True)
	completed_at = models.DateTimeField(blank=True, null=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=['progress', 'course'], name='dashboard_progress_course_uniq'),
		]


class SimulationLessonVideoCompletion(models.Model):
	progress = models.ForeignKey(SimulationProgress, on_delete=models.CASCADE, related_name='video_completions')
	course = models.ForeignKey(SimulationCourse, on_delete=models.PROTECT, related_name='video_completions')
	lesson = models.ForeignKey(SimulationLesson, on_delete=models.SET_NULL, blank=True, null=True, related_name='video_completions')
	completion_key = models.TextField()
	is_completed = models.BooleanField(default=False)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=['progress', 'completion_key'], name='dashboard_progress_video_key_uniq'),
		]


class SimulationModuleQuiz(models.Model):
	STATUS_DRAFT = 'draft'
	STATUS_PUBLISHED = 'published'
	STATUS_ARCHIVED = 'archived'
	STATUS_CHOICES = [
		(STATUS_DRAFT, 'Draft'),
		(STATUS_PUBLISHED, 'Published'),
		(STATUS_ARCHIVED, 'Archived'),
	]

	course_record = models.ForeignKey(SimulationCourse, on_delete=models.PROTECT, related_name='quizzes')
	lesson_record = models.ForeignKey(SimulationLesson, on_delete=models.PROTECT, related_name='quizzes')
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
			models.Index(fields=['course_record', 'lesson_record', 'status']),
		]

	@property
	def course_id(self):
		return self.course_record_id

	@property
	def lesson_id(self):
		return self.lesson_record.lesson_id if self.lesson_record_id else ''

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


<<<<<<< HEAD
class SimulationExamAttempt(models.Model):
	"""An attempt at an exam lesson from the course catalog, graded on the server."""

	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='simulation_exam_attempts')
	course_id = models.CharField(max_length=120, db_index=True)
	lesson_id = models.CharField(max_length=120)
	answers = models.JSONField(default=dict, blank=True)
	score = models.PositiveSmallIntegerField(default=0)
	total_questions = models.PositiveSmallIntegerField(default=0)
	passed = models.BooleanField(default=False)
	attempted_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-attempted_at', '-id']
		indexes = [
			models.Index(fields=['user', 'course_id', 'lesson_id', 'attempted_at']),
		]

	def __str__(self):
		return f"Exam attempt {self.user_id} - {self.course_id}:{self.lesson_id} ({self.score}%)"

=======
class SimulationQuizAnswer(models.Model):
	attempt = models.ForeignKey(SimulationQuizAttempt, on_delete=models.CASCADE, related_name='answer_records')
	question = models.ForeignKey(SimulationQuizQuestion, on_delete=models.SET_NULL, blank=True, null=True, related_name='answers')
	selected_choice = models.ForeignKey(
		'SimulationQuizChoice',
		on_delete=models.SET_NULL,
		blank=True,
		null=True,
		related_name='selected_answers',
	)
	question_key = models.TextField()
	selected_choice_key = models.TextField(blank=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=['attempt', 'question_key'], name='dashboard_attempt_question_key_uniq'),
		]

>>>>>>> f1cb84bd463e4ad4338a1cdd47d0927e338c2e84

class SimulationCourseCatalog(models.Model):
	key = models.CharField(max_length=64, unique=True, default='default')
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
	course_record = models.ForeignKey(SimulationCourse, on_delete=models.PROTECT, related_name='certificates')
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
		unique_together = ('user', 'course_record')
		indexes = [
			models.Index(fields=['status']),
		]

	def __str__(self):
		return f"{self.user.username} - {self.course_id} ({self.status})"

	@property
	def course_id(self):
		return self.course_record_id
