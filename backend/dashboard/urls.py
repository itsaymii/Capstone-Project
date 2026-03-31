from django.urls import path

from .views import admin_dashboard_summary, create_dashboard_account, dashboard_account_detail, list_dashboard_accounts, simulation_admin_metrics, simulation_progress

urlpatterns = [
    path('admin/summary/', admin_dashboard_summary, name='admin-dashboard-summary'),
    path('admin/accounts/', list_dashboard_accounts, name='admin-dashboard-accounts'),
    path('admin/accounts/create/', create_dashboard_account, name='admin-dashboard-create-account'),
    path('admin/accounts/<int:user_id>/', dashboard_account_detail, name='admin-dashboard-account-detail'),
    path('admin/simulation/metrics/', simulation_admin_metrics, name='admin-simulation-metrics'),
    path('simulation/progress/', simulation_progress, name='simulation-progress'),
]
