from datetime import datetime

from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse

from accounts.models import AccountProfile

from .models import (
    SimulationCourse,
    SimulationCourseProgress,
    SimulationLesson,
    SimulationModuleQuiz,
    SimulationProgress,
    SimulationQuizChoice,
    SimulationQuizQuestion,
)


class DashboardViewsTests(TestCase):
    def test_admin_summary_requires_authentication(self):
        response = self.client.get(reverse('admin-dashboard-summary'))

        self.assertIn(response.status_code, [401, 403])

    def test_admin_summary_rejects_non_admin_user(self):
        user = User.objects.create_user(username='regular-user', password='secret123')
        self.client.force_login(user)

        response = self.client.get(reverse('admin-dashboard-summary'))

        self.assertEqual(response.status_code, 403)

    def test_admin_summary_returns_expected_shape(self):
        admin_user = User.objects.create_user(username='admin-user', password='secret123', is_staff=True)
        AccountProfile.objects.update_or_create(user=admin_user, defaults={'role': AccountProfile.ROLE_ADMIN})
        self.client.force_login(admin_user)

        response = self.client.get(reverse('admin-dashboard-summary'))

        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertIn('summary', payload)

        summary = payload['summary']
        self.assertIn('totalUsers', summary)
        self.assertIn('totalAdminUsers', summary)
        self.assertIn('activeUsersLast30Days', summary)
        self.assertIn('pendingOtps', summary)
        self.assertIn('verifiedOtpsToday', summary)

    def test_simulation_metrics_require_admin_access(self):
        user = User.objects.create_user(username='regular-user', password='secret123')
        self.client.force_login(user)

        response = self.client.get(reverse('admin-simulation-metrics'))

        self.assertEqual(response.status_code, 403)

    def test_simulation_metrics_return_aggregated_course_stats(self):
        admin_user = User.objects.create_user(username='admin-user', password='secret123', is_staff=True)
        admin_user.account_profile.role = AccountProfile.ROLE_ADMIN
        admin_user.account_profile.save(update_fields=['role', 'updated_at'])
        user_one = User.objects.create_user(username='learner-one', password='secret123')
        user_two = User.objects.create_user(username='learner-two', password='secret123')
        user_three = User.objects.create_user(username='learner-three', password='secret123')

        earthquake = SimulationCourse.objects.create(course_id='earthquake', title='Earthquake')
        fire = SimulationCourse.objects.create(course_id='fire', title='Fire')
        progress_one = SimulationProgress.objects.create(user=user_one)
        progress_two = SimulationProgress.objects.create(user=user_two)
        progress_three = SimulationProgress.objects.create(user=user_three)
        SimulationCourseProgress.objects.create(
            progress=progress_one,
            course=earthquake,
            completion_percentage=100,
            completed_at=datetime.fromisoformat('2026-03-31T08:00:00+00:00'),
        )
        SimulationCourseProgress.objects.create(progress=progress_one, course=fire, completion_percentage=20)
        SimulationCourseProgress.objects.create(progress=progress_two, course=earthquake, completion_percentage=50)
        SimulationCourseProgress.objects.create(
            progress=progress_three,
            course=fire,
            completion_percentage=100,
            completed_at=datetime.fromisoformat('2026-03-31T09:00:00+00:00'),
        )

        self.client.force_login(admin_user)
        response = self.client.get(reverse('admin-simulation-metrics'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('courses', payload)
        self.assertEqual(payload['courses']['earthquake']['trainees'], 2)
        self.assertEqual(payload['courses']['earthquake']['completed'], 1)
        self.assertEqual(payload['courses']['earthquake']['completionRate'], 50)
        self.assertEqual(payload['courses']['fire']['trainees'], 2)
        self.assertEqual(payload['courses']['fire']['completed'], 1)
        self.assertEqual(payload['courses']['fire']['completionRate'], 50)

    def test_simulation_progress_round_trips_through_relational_records(self):
        user = User.objects.create_user(username='learner', password='secret123')
        self.client.force_login(user)
        completed_at = '2026-03-31T08:00:00+00:00'

        response = self.client.put(
            reverse('simulation-progress'),
            data={
                'courseProgress': {'earthquake': 75},
                'completedLessonVideos': {'earthquake:lesson-1': True, 'earthquake:lesson-2': False},
                'completedCourses': {'earthquake': completed_at, 'fire': completed_at},
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['courseProgress'], {'earthquake': 75})
        self.assertEqual(payload['completedLessonVideos'], {
            'earthquake:lesson-1': True,
            'earthquake:lesson-2': False,
        })
        self.assertIn('earthquake', payload['completedCourses'])
        self.assertIn('fire', payload['completedCourses'])
        self.assertNotIn('fire', payload['courseProgress'])
        progress = SimulationProgress.objects.get(user=user)
        self.assertEqual(progress.course_records.count(), 2)
        self.assertEqual(progress.video_completions.count(), 2)

    def test_simulation_course_sync_archive_and_restore_keep_api_shape(self):
        admin_user = User.objects.create_user(username='course-admin', password='secret123', is_staff=True)
        admin_user.account_profile.role = AccountProfile.ROLE_ADMIN
        admin_user.account_profile.save(update_fields=['role', 'updated_at'])
        self.client.force_login(admin_user)
        course_payload = {
            'id': 'earthquake',
            'title': 'Earthquake Safety',
            'tag': 'Preparedness',
            'difficulty': 'Beginner',
            'duration': '30 min',
            'description': 'Learn the basics.',
            'audience': 'Residents',
            'objectives': ['Prepare a kit'],
            'prerequisites': [],
            'accent': '#123456',
            'heroImageUrl': '',
            'lessonOutline': [{
                'id': 'lesson-1',
                'lessonType': 'exam',
                'title': 'Before an Earthquake',
                'duration': '10 min',
                'videoUrl': '',
                'summary': '',
                'points': ['Secure heavy furniture'],
                'content': '',
                'examQuestions': [{
                    'id': 'exam-q1',
                    'prompt': 'Did you prepare an emergency kit?',
                    'options': ['Yes', 'No'],
                    'correctOptionIndex': 0,
                    'explanation': 'Keep essential supplies ready.',
                }],
                'passingScore': 80,
            }],
            'learningMaterials': [{
                'id': 'guide-1',
                'title': 'Earthquake Guide',
                'type': 'PDF',
                'url': '/earthquake.pdf',
                'fileName': 'earthquake.pdf',
                'mimeType': 'application/pdf',
                'description': 'Preparedness guide',
            }],
        }

        response = self.client.put(
            reverse('admin-simulation-courses-sync'),
            data={'courses': [course_payload]},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['courses'][0]['lessonOutline'][0]['points'], ['Secure heavy furniture'])
        self.assertEqual(
            response.json()['courses'][0]['lessonOutline'][0]['examQuestions'][0]['options'],
            ['Yes', 'No'],
        )
        self.assertEqual(response.json()['courses'][0]['learningMaterials'][0]['id'], 'guide-1')

        self.client.force_login(User.objects.create_user(username='learner', password='secret123'))
        response = self.client.get(reverse('simulation-courses'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['courses'][0]['id'], 'earthquake')

        self.client.force_login(admin_user)
        response = self.client.put(
            reverse('admin-simulation-courses-sync'),
            data={'courses': []},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        archived = self.client.get(reverse('admin-simulation-courses-archived'))
        self.assertEqual(archived.status_code, 200)
        self.assertEqual(archived.json()['courses'][0]['id'], 'earthquake')

        restored = self.client.post(
            reverse('admin-simulation-courses-restore'),
            data={'courseId': 'earthquake'},
            content_type='application/json',
        )
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.json()['courses'][0]['id'], 'earthquake')

    def test_module_quiz_and_certificate_workflows_use_course_relations(self):
        user = User.objects.create_user(username='trainee', password='secret123')
        course = SimulationCourse.objects.create(
            course_id='earthquake',
            title='Earthquake Safety',
            is_archived=False,
        )
        lesson = SimulationLesson.objects.create(
            course=course,
            lesson_id='lesson-1',
            title='Before an Earthquake',
        )
        quiz = SimulationModuleQuiz.objects.create(
            course_record=course,
            lesson_record=lesson,
            lesson_title=lesson.title,
            title='Safety Quiz',
            status=SimulationModuleQuiz.STATUS_PUBLISHED,
        )
        question = SimulationQuizQuestion.objects.create(quiz=quiz, prompt='Secure heavy objects?')
        correct_choice = SimulationQuizChoice.objects.create(
            question=question,
            text='Yes',
            is_correct=True,
        )
        SimulationQuizChoice.objects.create(question=question, text='No', is_correct=False)
        self.client.force_login(user)

        quiz_response = self.client.get(
            reverse('simulation-module-quiz'),
            {'course_id': course.course_id, 'lesson_id': lesson.lesson_id},
        )
        self.assertEqual(quiz_response.status_code, 200)
        self.assertEqual(quiz_response.json()['quiz']['lessonId'], 'lesson-1')

        attempt_response = self.client.post(
            reverse('simulation-quiz-submit', kwargs={'quiz_id': quiz.id}),
            data={'answers': {str(question.id): correct_choice.id}},
            content_type='application/json',
        )
        self.assertEqual(attempt_response.status_code, 200)
        self.assertTrue(attempt_response.json()['passed'])
        self.assertEqual(quiz.attempts.get().answer_records.get().selected_choice_id, correct_choice.id)

        self.client.put(
            reverse('simulation-progress'),
            data={
                'courseProgress': {'earthquake': 100},
                'completedLessonVideos': {'earthquake:lesson-1': True},
                'completedCourses': {'earthquake': '2026-03-31T08:00:00+00:00'},
            },
            content_type='application/json',
        )
        certificate_response = self.client.post(
            reverse('simulation-certificate-request'),
            data={'courseId': course.course_id, 'courseTitle': course.title},
            content_type='application/json',
        )
        self.assertEqual(certificate_response.status_code, 200)
        self.assertEqual(certificate_response.json()['courseId'], course.course_id)

        admin_user = User.objects.create_user(username='reset-admin', password='secret123', is_staff=True)
        admin_user.account_profile.role = AccountProfile.ROLE_ADMIN
        admin_user.account_profile.save(update_fields=['role', 'updated_at'])
        self.client.force_login(admin_user)
        reset_response = self.client.post(
            reverse('admin-simulation-progress-reset'),
            data={'userId': user.id},
            content_type='application/json',
        )
        self.assertEqual(reset_response.status_code, 200)
        self.assertEqual(reset_response.json()['deletedAttempts'], 1)
        self.assertEqual(reset_response.json()['deletedCertificates'], 1)

    def test_create_dashboard_account_accepts_staff_role(self):
        admin_user = User.objects.create_user(username='admin-user', password='secret123', is_staff=True)
        admin_user.account_profile.role = AccountProfile.ROLE_ADMIN
        admin_user.account_profile.save(update_fields=['role', 'updated_at'])
        self.client.force_login(admin_user)

        response = self.client.post(
            reverse('admin-dashboard-create-account'),
            data={
                'fullName': 'Staff Responder',
                'email': 'staff@example.com',
                'password': 'secret123',
                'role': 'staff',
                'team': 'Team Bravo',
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload['user']['role'], AccountProfile.ROLE_STAFF)
        self.assertEqual(payload['user']['team'], 'Bravo')
        self.assertTrue(payload['user']['hasDashboardAccess'])

    def test_staff_accounts_need_a_team(self):
        admin_user = User.objects.create_user(username='admin-user', password='secret123', is_staff=True)
        admin_user.account_profile.role = AccountProfile.ROLE_ADMIN
        admin_user.account_profile.save(update_fields=['role', 'updated_at'])
        self.client.force_login(admin_user)
        url = reverse('admin-dashboard-create-account')

        for team in ('', 'Delta', 'Juan Dela Cruz'):
            response = self.client.post(url, data={
                'fullName': 'Juan Dela Cruz', 'email': 'juan@example.com', 'password': 'secret123', 'role': 'staff', 'team': team,
            })
            self.assertEqual(response.status_code, 400, team)
        self.assertFalse(User.objects.filter(email='juan@example.com').exists())

        # Admins and citizens have no team, whatever is sent.
        response = self.client.post(url, data={
            'fullName': 'Ana', 'email': 'ana@example.com', 'password': 'secret123', 'role': 'citizen', 'team': 'Alpha',
        })
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.json()['user']['team'])

    def test_list_dashboard_accounts_returns_explicit_roles(self):
        admin_user = User.objects.create_user(username='admin-user', password='secret123', is_staff=True)
        admin_user.account_profile.role = AccountProfile.ROLE_ADMIN
        admin_user.account_profile.save(update_fields=['role', 'updated_at'])

        staff_user = User.objects.create_user(username='staff-user', password='secret123', is_staff=True)
        staff_user.account_profile.role = AccountProfile.ROLE_STAFF
        staff_user.account_profile.save(update_fields=['role', 'updated_at'])

        citizen = User.objects.create_user(username='citizen-user', password='secret123')

        self.client.force_login(admin_user)
        response = self.client.get(reverse('admin-dashboard-accounts'))

        self.assertEqual(response.status_code, 200)
        roles_by_username = {user['username']: user['role'] for user in response.json()['users']}
        self.assertEqual(roles_by_username['admin-user'], AccountProfile.ROLE_ADMIN)
        self.assertEqual(roles_by_username['staff-user'], AccountProfile.ROLE_STAFF)
        self.assertEqual(roles_by_username['citizen-user'], AccountProfile.ROLE_CITIZEN)
