from rest_framework import permissions
from .models import AccountProfile, get_user_role, user_has_dashboard_access


class IsAdminOrStaff(permissions.BasePermission):
    """
    Custom permission to only allow admins and staff.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        try:
            profile = AccountProfile.objects.get(user=request.user)
            return profile.role in [AccountProfile.ROLE_ADMIN, AccountProfile.ROLE_STAFF]
        except:
            return False

class IsDashboardUser(permissions.BasePermission):
    """Logged-in admin or staff (responder) accounts only, for reads and writes."""
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user_has_dashboard_access(user))


class IsDashboardAdmin(permissions.BasePermission):
    """Logged-in admin accounts only. Staff (responders) are not admins."""
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and get_user_role(user) == AccountProfile.ROLE_ADMIN)


class IsResponderCreateAdminChange(permissions.BasePermission):
    """
    Admin and staff may list and read. Only responders (staff) may file reports, so every report
    has a responder team. Only admins may edit or delete, which is also how reports get approved.
    """
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user_has_dashboard_access(user)):
            return False

        if request.method in permissions.SAFE_METHODS:
            return True
        if request.method == 'POST':
            return get_user_role(user) == AccountProfile.ROLE_STAFF

        return get_user_role(user) == AccountProfile.ROLE_ADMIN


class IsDashboardAdminOrReadOnly(permissions.BasePermission):
    """
    Anyone may read (public pages show evacuation centers, barangays, hazard types).
    Only admin accounts may add, edit or delete. Responders (staff) stay on the responder side.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        user = request.user
        return bool(user and user.is_authenticated and get_user_role(user) == AccountProfile.ROLE_ADMIN)
