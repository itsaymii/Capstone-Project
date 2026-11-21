# analytics/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('barangay-risk/', views.barangay_risk_view, name='barangay-risk'),
    path('citywide-earthquake-risk/', views.citywide_earthquake_risk_view, name='citywide-earthquake-risk'),
    path('barangay-risk-ranking/', views.barangay_risk_ranking_view, name='barangay-risk-ranking'),
    path('performance/', views.response_performance_view, name='response-performance'),
]