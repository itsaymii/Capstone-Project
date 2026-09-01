from django.urls import path

from .views import (
    admin_dashboard_summary,
    create_dashboard_account,
    dashboard_account_detail,
    list_dashboard_accounts,
    simulation_admin_metrics,
    simulation_admin_quiz_detail,
    simulation_admin_quiz_publish,
    simulation_admin_sync_courses,
    simulation_admin_quiz_update,
    simulation_admin_upload_quiz_pdf,
    simulation_courses,
    simulation_module_quiz,
    simulation_progress,
    simulation_submit_quiz_attempt,
)

urlpatterns = [
    path('admin/summary/', admin_dashboard_summary, name='admin-dashboard-summary'),
    path('admin/accounts/', list_dashboard_accounts, name='admin-dashboard-accounts'),
    path('admin/accounts/create/', create_dashboard_account, name='admin-dashboard-create-account'),
    path('admin/accounts/<int:user_id>/', dashboard_account_detail, name='admin-dashboard-account-detail'),
    path('admin/simulation/metrics/', simulation_admin_metrics, name='admin-simulation-metrics'),
    path('admin/simulation/courses/sync/', simulation_admin_sync_courses, name='admin-simulation-courses-sync'),
    path('admin/simulation/quizzes/module/', simulation_admin_quiz_detail, name='admin-simulation-quiz-detail'),
    path('admin/simulation/quizzes/upload-pdf/', simulation_admin_upload_quiz_pdf, name='admin-simulation-quiz-upload-pdf'),
    path('admin/simulation/quizzes/<int:quiz_id>/', simulation_admin_quiz_update, name='admin-simulation-quiz-update'),
    path('admin/simulation/quizzes/<int:quiz_id>/publish/', simulation_admin_quiz_publish, name='admin-simulation-quiz-publish'),
    path('simulation/courses/', simulation_courses, name='simulation-courses'),
    path('simulation/progress/', simulation_progress, name='simulation-progress'),
    path('simulation/quizzes/module/', simulation_module_quiz, name='simulation-module-quiz'),
    path('simulation/quizzes/<int:quiz_id>/submit/', simulation_submit_quiz_attempt, name='simulation-quiz-submit'),
]
