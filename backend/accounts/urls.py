from django.urls import path
from .views import (
    confirm_password_reset,
    issue_csrf_cookie,
    login_user,
    request_password_reset,
    register_user,
    test_connection,
    verify_login_otp,
    verify_register_otp,
)

urlpatterns = [
    path('test/', test_connection, name='test-connection'),
    path('auth/csrf/', issue_csrf_cookie, name='issue-csrf-cookie'),
    path('auth/register/', register_user, name='register-user'),
    path('auth/register/verify-otp/', verify_register_otp, name='verify-register-otp'),
    path('auth/login/', login_user, name='login-user'),
    path('auth/login/verify-otp/', verify_login_otp, name='verify-login-otp'),
    path('auth/password-reset/', request_password_reset, name='request-password-reset'),
    path('auth/password-reset/confirm/', confirm_password_reset, name='confirm-password-reset'),
]
