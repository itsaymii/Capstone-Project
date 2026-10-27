# analytics/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('barangay-risk/', views.barangay_risk_view, name='barangay-risk'),
    path('barangay-risk-ranking/', views.barangay_risk_ranking_view, name='barangay-risk-ranking'),
    path('hazard-insights/', views.hazard_insights_view, name='hazard-insights'),
    path('performance/', views.response_performance_view, name='response-performance'),
]