"""
Simulation training: exams graded on the server, attempt limits, and certificates only after
every exam and module quiz is passed.

    python manage.py test dashboard.tests_simulation
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import AccountProfile, ensure_account_profile

from .models import (
    SimulationCourse,
    SimulationLesson,
    SimulationModuleQuiz,
    SimulationQuizChoice,
    SimulationQuizQuestion,
)

COURSE_ID = 'fire-101'
EXAM = {
    'id': 'final-exam',
    'lessonType': 'exam',
    'title': 'Final Exam',
    'passingScore': 50,
    'examQuestions': [
        {'id': 'q1', 'prompt': 'Call?', 'options': ['911', '123'], 'correctOptionIndex': 0, 'explanation': 'Emergency hotline.'},
        {'id': 'q2', 'prompt': 'Stop, drop and?', 'options': ['Run', 'Roll'], 'correctOptionIndex': 1, 'explanation': 'Roll.'},
    ],
}
COURSE = {
    'id': COURSE_ID,
    'title': 'Fire Safety 101',
    'lessonOutline': [
        {'id': 'intro', 'lessonType': 'video', 'title': 'Introduction'},
        EXAM,
    ],
}
RIGHT = {'q1': 0, 'q2': 1}
WRONG = {'q1': 1, 'q2': 0}


class SimulationTestCase(TestCase):
    def setUp(self):
        self.citizen = User.objects.create_user('learner', 'learner@test.local', 'Pass12345', first_name='Lea')
        ensure_account_profile(self.citizen)
        self.client = APIClient()
        self.client.force_authenticate(self.citizen)

        admin = User.objects.create_user('trainer', 'trainer@test.local', 'Pass12345', is_staff=True)
        AccountProfile.objects.update_or_create(user=admin, defaults={'role': AccountProfile.ROLE_ADMIN})
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(admin)

        sync_response = self.admin_client.put(
            '/dashboard/admin/simulation/courses/sync/',
            {'courses': [COURSE]},
            format='json',
        )
        self.assertEqual(sync_response.status_code, 200, sync_response.data)
        course = SimulationCourse.objects.get(course_id=COURSE_ID)
        lesson = SimulationLesson.objects.get(course=course, lesson_id='intro')

        # A published module quiz on the video lesson.
        self.quiz = SimulationModuleQuiz.objects.create(
            course_record=course, lesson_record=lesson, lesson_title='Introduction', title='Intro quiz',
            passing_score=100, status=SimulationModuleQuiz.STATUS_PUBLISHED,
        )
        question = SimulationQuizQuestion.objects.create(quiz=self.quiz, prompt='Exit?', explanation='Nearest exit.')
        self.right_choice = SimulationQuizChoice.objects.create(question=question, text='Nearest exit', is_correct=True)
        self.wrong_choice = SimulationQuizChoice.objects.create(question=question, text='Elevator', order=1)
        self.question = question

    def submit_exam(self, answers):
        return self.client.post(
            '/dashboard/simulation/exams/submit/',
            {'courseId': COURSE_ID, 'lessonId': EXAM['id'], 'answers': answers},
            format='json',
        )

    def submit_quiz(self, choice):
        return self.client.post(
            f'/dashboard/simulation/quizzes/{self.quiz.id}/submit/',
            {'answers': {str(self.question.id): choice.id}},
            format='json',
        )

    def claim_course_finished(self):
        self.client.put(
            '/dashboard/simulation/progress/',
            {'completedCourses': {COURSE_ID: '2026-10-30T08:00:00+08:00'}},
            format='json',
        )

    def request_certificate(self):
        return self.client.post(
            '/dashboard/simulation/certificates/request/',
            {'courseId': COURSE_ID, 'courseTitle': 'Fake Title'},
            format='json',
        )


class ExamAnswersTests(SimulationTestCase):
    def test_learners_do_not_get_exam_answers(self):
        exam = self.client.get('/dashboard/simulation/courses/').json()['courses'][0]['lessonOutline'][1]
        self.assertEqual(exam['examQuestions'][0]['options'], ['911', '123'])
        self.assertNotIn('correctOptionIndex', exam['examQuestions'][0])
        self.assertNotIn('explanation', exam['examQuestions'][0])

    def test_admins_still_get_exam_answers_for_editing(self):
        exam = self.admin_client.get('/dashboard/simulation/courses/').json()['courses'][0]['lessonOutline'][1]
        self.assertEqual(exam['examQuestions'][1]['correctOptionIndex'], 1)

    def test_exam_is_graded_on_the_server(self):
        failed = self.submit_exam(WRONG).json()
        self.assertFalse(failed['passed'])
        self.assertEqual(failed['score'], 0)
        self.assertEqual(failed['details'], [])  # no answers after a failed attempt
        self.assertEqual(failed['attemptsLeft'], 2)

        passed = self.submit_exam(RIGHT).json()
        self.assertTrue(passed['passed'])
        self.assertEqual(passed['details'][1]['correctOptionIndex'], 1)
        progress = self.client.get('/dashboard/simulation/progress/').json()
        self.assertTrue(progress['completedLessonVideos'][f'{COURSE_ID}:{EXAM["id"]}'])

    def test_unanswered_exam_is_not_graded_or_counted(self):
        response = self.submit_exam({'q1': 0})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.submit_exam(WRONG).json()['attemptsLeft'], 2)


class AttemptLimitTests(SimulationTestCase):
    def test_exam_allows_three_attempts_per_day(self):
        for _ in range(3):
            self.assertEqual(self.submit_exam(WRONG).status_code, 200)
        blocked = self.submit_exam(RIGHT)
        self.assertEqual(blocked.status_code, 429)
        self.assertGreater(blocked.json()['retryAfterSeconds'], 0)

    def test_module_quiz_allows_three_attempts_per_day_and_hides_answers_on_fail(self):
        failed = self.submit_quiz(self.wrong_choice).json()
        self.assertFalse(failed['passed'])
        self.assertEqual(failed['details'], [])
        self.submit_quiz(self.wrong_choice)
        self.submit_quiz(self.wrong_choice)
        self.assertEqual(self.submit_quiz(self.right_choice).status_code, 429)


class CertificateTests(SimulationTestCase):
    def test_claiming_the_course_is_finished_is_not_enough(self):
        self.claim_course_finished()
        response = self.request_certificate()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()['missing'],
            ['Final Exam (exam)', 'Introduction (module quiz)'],
        )

    def test_certificate_after_passing_every_exam_and_quiz(self):
        self.claim_course_finished()
        self.submit_exam(RIGHT)
        self.assertEqual(self.request_certificate().status_code, 400)  # quiz still missing

        self.submit_quiz(self.right_choice)
        response = self.request_certificate()
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()['courseTitle'], 'Fire Safety 101')  # from the catalog, not the browser
        self.assertEqual(response.json()['status'], 'pending')  # an admin still reviews it

    def test_unknown_course_is_refused(self):
        response = self.client.post(
            '/dashboard/simulation/certificates/request/', {'courseId': 'made-up', 'courseTitle': 'X'}, format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_admin_can_reset_normalized_progress_and_attempts(self):
        self.claim_course_finished()
        self.submit_exam(RIGHT)
        self.submit_quiz(self.right_choice)

        response = self.admin_client.post('/dashboard/admin/simulation/progress/reset/', format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['deletedAttempts'], 2)
        self.assertEqual(response.data['resetUsers'], 1)
        self.assertEqual(self.client.get('/dashboard/simulation/progress/').json()['completedLessonVideos'], {})
