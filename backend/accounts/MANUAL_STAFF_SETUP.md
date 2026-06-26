# Manual Staff Account Creation Guide

If the management command doesn't work or you prefer manual setup, follow these steps:

## Option 1: Django Shell

```bash
cd backend
python manage.py shell
```

Then paste this code:

```python
from django.contrib.auth.models import User
from accounts.models import AccountProfile

# Create staff account 1
user1 = User.objects.create_user(
    username='staff_responder',
    email='staff@responder.com',
    password='Responder@123',
    first_name='John',
    last_name='Responder'
)
user1.is_staff = True
user1.save()
AccountProfile.objects.create(user=user1, role='staff')
print("✓ Created: staff_responder")

# Create staff account 2
user2 = User.objects.create_user(
    username='fire_team_lead',
    email='maria.santos@fire.com',
    password='FireTeam@123',
    first_name='Maria',
    last_name='Santos'
)
user2.is_staff = True
user2.save()
AccountProfile.objects.create(user=user2, role='staff')
print("✓ Created: fire_team_lead")

# Create staff account 3
user3 = User.objects.create_user(
    username='medical_responder',
    email='carlos.cruz@ems.com',
    password='Medical@123',
    first_name='Carlos',
    last_name='Cruz'
)
user3.is_staff = True
user3.save()
AccountProfile.objects.create(user=user3, role='staff')
print("✓ Created: medical_responder")

# Verify accounts were created
print(f"\nTotal staff users: {User.objects.filter(is_staff=True).count()}")
```

Type `exit()` when done.

## Option 2: Django Admin Panel

1. Login to `/admin` with an admin account
2. Go to **Accounts > Account Profiles**
3. Add new staff profiles for existing users (if users exist)
4. Or go to **Authentication and Authorization > Users** and create users there first

## Option 3: Using Fixture (if you prefer JSON)

1. Load the fixture:
```bash
cd backend
python manage.py loaddata accounts/fixtures/sample_staff.json
```

**Note**: The fixture needs passwords to be regenerated. After loading, reset passwords using Django shell:

```python
from django.contrib.auth.models import User
User.objects.get(username='staff_responder').set_password('Responder@123')
User.objects.get(username='staff_responder').save()
```

## Option 4: SQL Insert (Database Direct)

If you have direct database access, insert into SQLite:

```sql
-- Insert users
INSERT INTO auth_user (username, first_name, last_name, email, password, is_staff, is_active, is_superuser, last_login, date_joined) 
VALUES ('staff_responder', 'John', 'Responder', 'staff@responder.com', 'pbkdf2_sha256$600000$salt123$hash123', 1, 1, 0, NULL, datetime('now'));

-- Get the user ID (should be the last inserted)
-- Then insert into account profile
INSERT INTO accounts_accountprofile (user_id, role, created_at, updated_at)
VALUES (2, 'staff', datetime('now'), datetime('now'));
```

**Note**: The password hash won't work - you'll need to reset it via Django shell.

## Testing Login

After creating accounts, test by:

1. Navigate to: `http://localhost:5173/login`
2. Enter credentials:
   - Username: `staff_responder`
   - Password: `Responder@123`
3. After login, you should be redirected to available dashboards
4. Access responder dashboard: `http://localhost:5173/responder-dashboard`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "User not found" error | Verify username is correct and user exists in database |
| "Permission denied" to responder dashboard | Ensure `is_staff=True` and `AccountProfile.role='staff'` |
| Can't login | Reset password using Django shell: `User.objects.get(username='X').set_password('NewPass123').save()` |
| Still seeing login page at `/responder-dashboard` | Clear browser cache and localStorage, ensure session is saved |
