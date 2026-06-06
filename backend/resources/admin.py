from django.contrib import admin
from .models import SupplyCategory, Supply, EvacuationCenter, Equipment, Volunteer


class SupplyInline(admin.TabularInline):
    model = Supply
    extra = 0


@admin.register(SupplyCategory)
class SupplyCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']
    search_fields = ['name']


@admin.register(Supply)
class SupplyAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'quantity', 'unit', 'status', 'storage_location']
    list_filter = ['status', 'category']
    search_fields = ['name']
    ordering = ['category', 'name']
    
    actions = ['mark_as_depleted', 'mark_as_available']
    
    def mark_as_depleted(self, request, queryset):
        queryset.update(status='depleted')
        self.message_user(request, f"{queryset.count()} supplies marked as depleted.")
    mark_as_depleted.short_description = "Mark selected as depleted"
    
    def mark_as_available(self, request, queryset):
        queryset.update(status='available')
        self.message_user(request, f"{queryset.count()} supplies marked as available.")
    mark_as_available.short_description = "Mark selected as available"


@admin.register(EvacuationCenter)
class EvacuationCenterAdmin(admin.ModelAdmin):
    list_display = ['name', 'barangay', 'address']
    list_filter = ['barangay']
    search_fields = ['name', 'address']
    ordering = ['name']


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'equipment_type', 'status', 'location', 'last_maintenance']
    list_filter = ['status', 'equipment_type']
    search_fields = ['name', 'serial_number', 'asset_number']
    ordering = ['equipment_type', 'name']
    
    actions = ['mark_as_maintenance', 'mark_as_available']
    
    def mark_as_maintenance(self, request, queryset):
        queryset.update(status='maintenance')
        self.message_user(request, f"{queryset.count()} equipment marked for maintenance.")
    mark_as_maintenance.short_description = "Mark for maintenance"
    
    def mark_as_available(self, request, queryset):
        queryset.update(status='available')
        self.message_user(request, f"{queryset.count()} equipment marked as available.")
    mark_as_available.short_description = "Mark as available"


@admin.register(Volunteer)
class VolunteerAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'barangay', 'status', 'contact_number']
    list_filter = ['status', 'barangay']
    search_fields = ['full_name', 'contact_number', 'email']
    ordering = ['full_name']