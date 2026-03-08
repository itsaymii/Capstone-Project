from django.contrib import admin
from .models import OneTimePassword


@admin.register(OneTimePassword)
class OneTimePasswordAdmin(admin.ModelAdmin):
	list_display = ('email', 'purpose', 'is_used', 'expires_at', 'created_at')
	list_filter = ('purpose', 'is_used')
	search_fields = ('email',)
