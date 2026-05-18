from django.contrib import admin
from .models import (
    HazardType, Incident, FireDetails, EarthquakeDetails,
    VehicularAccident, CrimeReport, MedicalEmergency,
    DrowningIncident, Alert, ResponderReport
)


class IncidentDetailInline(admin.StackedInline):
    """Base inline for incident details"""
    extra = 0
    can_delete = False
    readonly_fields = ['created_at', 'updated_at']


class FireDetailsInline(IncidentDetailInline):
    model = FireDetails


class EarthquakeDetailsInline(IncidentDetailInline):
    model = EarthquakeDetails


class VehicularAccidentInline(IncidentDetailInline):
    model = VehicularAccident


class CrimeReportInline(IncidentDetailInline):
    model = CrimeReport


class MedicalEmergencyInline(IncidentDetailInline):
    model = MedicalEmergency


class DrowningIncidentInline(IncidentDetailInline):
    model = DrowningIncident


class AlertInline(admin.TabularInline):
    model = Alert
    extra = 0
    can_delete = True
    fields = ['alert_type', 'severity', 'message', 'is_active']


class ResponderReportInline(admin.TabularInline):
    model = ResponderReport
    extra = 0
    can_delete = False
    fields = ['responder', 'report_time', 'status_update', 'report_text']
    readonly_fields = ['responder', 'report_time', 'report_text', 'action_taken']


@admin.register(HazardType)
class HazardTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['name']


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = [
        'hazard_type', 
        'address', 
        'severity_level', 
        'status', 
        'impact_level',
        'incident_datetime',
        'reported_by'
    ]
    list_filter = ['status', 'severity_level', 'impact_level', 'hazard_type']
    search_fields = ['description', 'address', 'id']
    ordering = ['-incident_datetime']
    date_hierarchy = 'incident_datetime'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('hazard_type', 'incident_datetime', 'description')
        }),
        ('Location', {
            'fields': ('latitude', 'longitude', 'address', 'barangay')
        }),
        ('Status', {
            'fields': ('status', 'severity_level', 'impact_level')
        }),
        ('Reporter', {
            'fields': ('reported_by', 'date_reported')
        }),
    )
    
    inlines = [
        FireDetailsInline,
        EarthquakeDetailsInline,
        VehicularAccidentInline,
        CrimeReportInline,
        MedicalEmergencyInline,
        DrowningIncidentInline,
        AlertInline,
        ResponderReportInline,
    ]


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['alert_type', 'incident', 'severity', 'is_active', 'sent_at', 'expires_at']
    list_filter = ['alert_type', 'severity', 'is_active']
    search_fields = ['message', 'incident__description']
    ordering = ['-sent_at']
    date_hierarchy = 'sent_at'
    
    actions = ['activate_alerts', 'deactivate_alerts']
    
    def activate_alerts(self, request, queryset):
        queryset.update(is_active=True)
        self.message_user(request, f"{queryset.count()} alerts activated.")
    activate_alerts.short_description = "Activate selected alerts"
    
    def deactivate_alerts(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, f"{queryset.count()} alerts deactivated.")
    deactivate_alerts.short_description = "Deactivate selected alerts"


@admin.register(ResponderReport)
class ResponderReportAdmin(admin.ModelAdmin):
    list_display = ['incident', 'responder', 'report_time', 'status_update']
    list_filter = ['status_update', 'report_time']
    search_fields = ['report_text', 'responder__username', 'incident__description']
    ordering = ['-report_time']
    date_hierarchy = 'report_time'
    readonly_fields = ['incident', 'responder', 'report_time']


# Register detail models (accessible separately if needed)
@admin.register(FireDetails)
class FireDetailsAdmin(admin.ModelAdmin):
    list_display = ['incident', 'cause', 'damage_estimate', 'casualties', 'injuries']
    search_fields = ['incident__description', 'cause']


@admin.register(EarthquakeDetails)
class EarthquakeDetailsAdmin(admin.ModelAdmin):
    list_display = ['incident', 'magnitude', 'depth', 'intensity']
    search_fields = ['incident__description']


@admin.register(VehicularAccident)
class VehicularAccidentAdmin(admin.ModelAdmin):
    list_display = ['incident', 'vehicles_involved', 'casualties', 'injuries', 'cause']
    search_fields = ['incident__description', 'cause']


@admin.register(CrimeReport)
class CrimeReportAdmin(admin.ModelAdmin):
    list_display = ['incident', 'crime_type', 'victims', 'suspects', 'arrested', 'case_status']
    list_filter = ['arrested', 'case_status']
    search_fields = ['incident__description', 'crime_type']


@admin.register(MedicalEmergency)
class MedicalEmergencyAdmin(admin.ModelAdmin):
    list_display = ['incident', 'emergency_type', 'patient_count', 'transported', 'hospital']
    search_fields = ['incident__description', 'emergency_type', 'hospital']


@admin.register(DrowningIncident)
class DrowningIncidentAdmin(admin.ModelAdmin):
    list_display = ['incident', 'victims', 'rescued', 'fatalities', 'water_body']
    search_fields = ['incident__description', 'water_body']