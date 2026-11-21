"""
Django settings for config project.
"""

import os
from pathlib import Path
from decouple import config, Csv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# ============================================
# Security Settings (from .env)
# ============================================
INSECURE_DEV_SECRET_KEY = 'django-insecure-change-this-in-production'
SECRET_KEY = config('SECRET_KEY', default=INSECURE_DEV_SECRET_KEY)
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# The development defaults above must never reach a real server.
if not DEBUG and (SECRET_KEY == INSECURE_DEV_SECRET_KEY or SECRET_KEY.startswith('django-insecure')):
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured('Set a real SECRET_KEY in backend/.env when DEBUG=False.')

# ============================================
# Application definition
# ============================================
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party apps
    'corsheaders',
    'rest_framework',
    'rest_framework.authtoken',
    
    # apps
    'accounts',
    'dashboard',
    'locations',
    'incidents',
    'resources',
    'analytics',
    'sms',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ============================================
# Database
# ============================================
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ============================================
# Password validation
# ============================================
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ============================================
# Internationalization
# ============================================
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Manila'  # Philippines timezone
USE_I18N = True
USE_TZ = True

# ============================================
# Static files
# ============================================
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ============================================
# Default primary key field type
# ============================================
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ============================================
# CORS Settings
# ============================================
# Where the frontend is served from. Add the real host (or a LAN address for phones) in .env,
# e.g. FRONTEND_ORIGINS=http://localhost:5173,http://192.168.1.20:5173
FRONTEND_ORIGINS = config(
    'FRONTEND_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv(),
)
CORS_ALLOWED_ORIGINS = FRONTEND_ORIGINS
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = FRONTEND_ORIGINS

if not DEBUG:
    SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=True, cast=bool)
    CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=True, cast=bool)

# ============================================
# Email Settings (from .env)
# ============================================
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_BACKEND = config(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default=EMAIL_HOST_USER or 'noreply@drms.local')

# OTP email customization
OTP_EMAIL_SUBJECT = config('OTP_EMAIL_SUBJECT', default='Your DRMS OTP Code')
OTP_EMAIL_BODY_TEMPLATE = config(
    'OTP_EMAIL_BODY_TEMPLATE',
    default=(
        'Hello,\n\n'
        'Your OTP code for {action_label} is: {otp_code}\n\n'
        'This code expires in {expiry_minutes} minutes.\n\n'
        'If you did not request this, you can ignore this email.'
    ),
)

# ============================================
# Django REST Framework Configuration
# ============================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,  # Increased from 20 to 100 for better performance
    'MAX_PAGE_SIZE': 10000,  # Allow clients to request up to 10000 items
    'DEFAULT_FILTER_BACKENDS': [
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    # Per IP address. Used by the login and OTP views in accounts/views.py.
    'DEFAULT_THROTTLE_RATES': {
        'login': config('LOGIN_THROTTLE_RATE', default='10/min'),
        'otp': config('OTP_THROTTLE_RATE', default='20/min'),
        'strategic_briefing': config('STRATEGIC_BRIEFING_THROTTLE_RATE', default='5/min'),
    },
}

import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Add these lines to settings.py
# Use decouple.config to read from environment or .env automatically.
SMS_BASE_URL = config('SMS_BASE_URL', default='')
SMS_USERNAME = config('SMS_USERNAME', default='')
SMS_PASSWORD = config('SMS_PASSWORD', default='')

GEMINI_API_KEY = config('GEMINI_API_KEY', default='')

# ============================================
# Custom Permission Classes
# ============================================
# (We'll create these in next steps)