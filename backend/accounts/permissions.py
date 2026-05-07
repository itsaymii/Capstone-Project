from rest_framework import permissions
from .models import AccountProfile


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow admins to edit objects.
    """
    def has_permission(self, request, view):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to admins
        return request.user and request.user.is_superuser


class IsStaffOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow staff/admin to edit objects.
    """
    def has_permission(self, request, view):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to staff/admin
        if not request.user or not request.user.is_authenticated:
            return False
        
        try:
            profile = AccountProfile.objects.get(user=request.user)
            return profile.role in [AccountProfile.ROLE_ADMIN, AccountProfile.ROLE_STAFF]
        except:
            return False


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