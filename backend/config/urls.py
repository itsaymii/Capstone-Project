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
import posixpath

from django.contrib import admin
from django.conf import settings
from django.http import Http404
from django.urls import include, path, re_path
from django.views.static import serve

# Folders under MEDIA_ROOT with personal documents. Admins open them through the API
# (dashboard_account_residency_proof), never by their /media/ link.
PRIVATE_MEDIA_FOLDERS = ('residency_verification_documents/',)


def serve_public_media(request, path):
    normalized = posixpath.normpath(path).lstrip('/').lower()
    if normalized.startswith(PRIVATE_MEDIA_FOLDERS):
        raise Http404('Not found.')
    return serve(request, path, document_root=settings.MEDIA_ROOT)
from rest_framework.response import Response
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def api_root(request):
    """Root API endpoint."""
    return Response({'message': 'Disaster Vision API Server', 'status': 'running'})

urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    path('accounts/', include('accounts.urls')),
    path('dashboard/', include('dashboard.urls')),
    path('api/locations/', include('locations.urls')),
    path('api/incidents/', include('incidents.urls')),
    path('api/resources/', include('resources.urls')),
    path('api/analytics/', include('analytics.urls')),
]

if settings.DEBUG:
    urlpatterns += [re_path(rf'^{settings.MEDIA_URL.lstrip("/")}(?P<path>.*)$', serve_public_media)]
