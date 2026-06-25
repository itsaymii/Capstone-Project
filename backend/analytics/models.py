import uuid
from django.db import models
from locations.models import Barangay
from incidents.models import HazardType

class BarangayRiskScore(models.Model):
    """Stores calculated 1-10 risk scores per barangay"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE, related_name='risk_scores')
    
    score = models.DecimalField(max_digits=3, decimal_places=1, help_text="1-10 risk rating")
    frequency_component = models.DecimalField(max_digits=3, decimal_places=1)
    severity_component = models.DecimalField(max_digits=3, decimal_places=1)
    recency_component = models.DecimalField(max_digits=3, decimal_places=1)
    
    algorithm_version = models.CharField(max_length=20, default='v1.0')
    calculated_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'analytics_barangay_risk_scores'
        ordering = ['-calculated_at']
        indexes = [models.Index(fields=['barangay', '-calculated_at'])]

    def __str__(self):
        return f"{self.barangay.name}: {self.score}/10"


class HazardPrediction(models.Model):
    """Stores predicted most probable hazard per barangay"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE, related_name='hazard_predictions')
    hazard_type = models.ForeignKey(HazardType, on_delete=models.SET_NULL, null=True)
    
    confidence = models.CharField(max_length=10, choices=[
        ('High', 'High'), ('Medium', 'Medium'), ('Low', 'Low')
    ])
    prediction_window_days = models.IntegerField(default=30)
    algorithm_version = models.CharField(max_length=20, default='v1.0')
    generated_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'analytics_hazard_predictions'
        ordering = ['-generated_at']
        unique_together = ['barangay', 'prediction_window_days']

    def __str__(self):
        h_name = self.hazard_type.name if self.hazard_type else 'Unknown'
        return f"{self.barangay.name} → {h_name} ({self.confidence})"


class InsightLog(models.Model):
    """Caches generated plain-English insights to avoid recomputation"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hazard_type = models.ForeignKey(HazardType, on_delete=models.CASCADE)
    insight_text = models.TextField()
    raw_stats_hash = models.CharField(max_length=64, help_text="SHA256 for cache invalidation")
    generated_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'analytics_insight_logs'
        indexes = [models.Index(fields=['hazard_type', '-generated_at'])]

    def __str__(self):
        return f"{self.hazard_type.name} insight ({self.generated_at.date()})"