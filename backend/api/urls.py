from django.urls import path

from .views import test_connection

urlpatterns = [
    path('test/', test_connection, name='test-connection'),
]
