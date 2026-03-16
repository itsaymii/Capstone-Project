from django.urls import path

from .views import admin_dashboard_summary, create_dashboard_account

urlpatterns = [
    path('admin/summary/', admin_dashboard_summary, name='admin-dashboard-summary'),
    path('admin/accounts/create/', create_dashboard_account, name='admin-dashboard-create-account'),
]
