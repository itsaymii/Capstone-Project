# analytics/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('barangay-risk/', views.barangay_risk_view, name='barangay-risk'),
    path('hazard-insights/', views.hazard_insights_view, name='hazard-insights'),
]