from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import User

from .models import AccountProfile, OneTimePassword


class AccountProfileInline(admin.StackedInline):
	model = AccountProfile
	can_delete = False
	extra = 0
	fields = ('role', 'phone_number')


class CustomUserAdmin(DjangoUserAdmin):
	inlines = (AccountProfileInline,)


@admin.register(OneTimePassword)
class OneTimePasswordAdmin(admin.ModelAdmin):
	list_display = ('email', 'purpose', 'is_used', 'expires_at', 'created_at')
	list_filter = ('purpose', 'is_used')
	search_fields = ('email',)


@admin.register(AccountProfile)
class AccountProfileAdmin(admin.ModelAdmin):
	list_display = ('user', 'role', 'phone_number')
	list_select_related = ('user',)
	search_fields = ('user__username', 'user__email', 'phone_number')
	list_filter = ('role',)


admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)
