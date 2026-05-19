"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path
from rest_framework.authtoken.views import obtain_auth_token


def backend_index(request):
    html = """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Capstone Backend</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; line-height: 1.6; color: #1f2937; }
          h1 { margin-bottom: 8px; }
          p { margin-top: 0; color: #4b5563; }
          ul { padding-left: 20px; }
          li { margin: 6px 0; }
          code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
          .card { max-width: 760px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Capstone Backend</h1>
          <p>Available routes:</p>
          <ul>
            <li><code>/admin/</code> — Django admin</li>
            <li><code>/api/token/</code> — auth token endpoint</li>
            <li><code>/accounts/test/</code> — backend health check</li>
            <li><code>/accounts/auth/csrf/</code> — CSRF cookie bootstrap</li>
            <li><code>/accounts/auth/register/</code> — register request</li>
            <li><code>/accounts/auth/register/verify-otp/</code> — verify registration OTP</li>
            <li><code>/accounts/auth/login/</code> — login request</li>
            <li><code>/accounts/auth/login/verify-otp/</code> — verify login OTP</li>
            <li><code>/accounts/auth/password-reset/</code> — password reset request</li>
            <li><code>/accounts/auth/password-reset/confirm/</code> — confirm password reset</li>
            <li><code>/dashboard/</code> — dashboard routes</li>
            <li><code>/api/locations/</code> — locations routes</li>
            <li><code>/api/incidents/</code> — incidents routes</li>
            <li><code>/api/resources/</code> — resources routes</li>
          </ul>
        </div>
      </body>
    </html>
    """
    return HttpResponse(html)


urlpatterns = [
    path('', backend_index, name='backend-index'),
    path('admin/', admin.site.urls),
    path('api/token/', obtain_auth_token, name='api-token'),
    path('accounts/', include('accounts.urls')),
    path('dashboard/', include('dashboard.urls')),
    path('api/locations/', include('locations.urls')),
    path('api/incidents/', include('incidents.urls')),
    path('api/resources/', include('resources.urls')),
]
