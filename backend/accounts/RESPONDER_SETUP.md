# Responder Dashboard Setup Guide

## 🔐 Staff Account Access

The Responder Dashboard is accessible **only to users with the "staff" role**. All staff users can access the responder dashboard at `/responder-dashboard`.

### Creating Sample Staff Accounts

To create sample staff credentials for testing, run the Django management command:

```bash
cd backend
python manage.py create_sample_staff_accounts
```

This will create **3 sample staff accounts** with the following credentials:

| Username | Email | Password | Role |
|----------|-------|----------|------|
| `staff_responder` | staff@responder.com | `Responder@123` | Staff |
| `fire_team_lead` | maria.santos@fire.com | `FireTeam@123` | Staff |
| `medical_responder` | carlos.cruz@ems.com | `Medical@123` | Staff |

### How to Access the Responder Dashboard

1. **Navigate to the login page**: `/login`
2. **Login with staff credentials** (e.g., username: `staff_responder`, password: `Responder@123`)
3. **Access the responder dashboard** at: `/responder-dashboard`

### Features Available

Once logged in as a staff member, you can access:

- **Dashboard View**: Quick stats on incidents, pending reports, completed reports, and active responders
- **Incident List View**: Browse and filter incidents assigned to your team
- **Report Creation**: Create accomplishment reports for selected incidents
- **Team Reports View**: View, download, and edit submitted reports

### Authentication Requirements

- ✅ Only users with **staff** role can access the responder dashboard
- ✅ Admin users can also access the responder dashboard
- ❌ Citizen users will be redirected to `/landing` if they try to access the dashboard

### Role Definitions

| Role | Dashboard Access | Features |
|------|------------------|----------|
| **admin** | ✅ Yes | Admin dashboard + all features |
| **staff** | ✅ Yes | Responder dashboard + features |
| **citizen** | ❌ No | Limited access to public pages only |

### Backend Configuration

Staff users are identified by:
- Django's `User.is_staff = True` flag
- `AccountProfile.role = 'staff'`

Both conditions define a user as a staff member with dashboard access.

---

## 🚀 Quick Start

```bash
# 1. Create sample staff accounts
python manage.py create_sample_staff_accounts

# 2. Start the backend server
python manage.py runserver

# 3. Start the frontend dev server (in another terminal)
cd frontend
npm run dev

# 4. Open browser and login
# URL: http://localhost:5173/login
# Username: staff_responder
# Password: Responder@123
```

---

## ⚠️ Production Note

These are **sample credentials for development/testing only**. Before deploying to production:
- Change all sample account passwords
- Create proper staff user management interface
- Implement secure password policies
- Remove or disable sample accounts
