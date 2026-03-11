from django.urls import path
from .views import (
    login_user,
    register_user,
    test_connection,
    verify_login_otp,
    verify_register_otp,
)

urlpatterns = [
    path('test/', test_connection, name='test-connection'),
    path('auth/register/', register_user, name='register-user'),
    path('auth/register/verify-otp/', verify_register_otp, name='verify-register-otp'),
    path('auth/login/', login_user, name='login-user'),
    path('auth/login/verify-otp/', verify_login_otp, name='verify-login-otp'),
]
