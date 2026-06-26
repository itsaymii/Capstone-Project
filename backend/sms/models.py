# sms/models.py
from django.db import models

class SMSLog(models.Model):
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('rate_limited', 'Rate Limited'),
    ]

    phone_number = models.CharField(max_length=20)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='success')
    send_at = models.DateTimeField(auto_now_add=True)
    
    # Optional: Link to the incident that triggered the SMS for easy tracking
    incident = models.ForeignKey(
        'incidents.Incident', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='sms_alerts'
    )

    class Meta:
        ordering = ['-send_at']

    def __str__(self):
        return f"SMS to {self.phone_number} ({self.status}) at {self.send_at}"