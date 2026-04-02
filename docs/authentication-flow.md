# Authentication Flow

This diagram reflects the current authentication behavior: unified login for all roles, OTP for citizens, OTP bypass for staff/admin, and OTP-based password reset.

## Unified Login

```mermaid
flowchart TD
	A[User enters email or username and password] --> B[React Login Page]
	B --> C[POST /accounts/auth/login/]
	C --> D{Credentials valid?}
	D -- No --> E[Return error]
	D -- Yes --> F[Resolve AccountProfile role]
	F --> G{Role is admin or staff?}
	G -- Yes --> H[Create Django session immediately]
	G -- No --> I{Recent verified login OTP within 5 minutes?}
	I -- Yes --> H
	I -- No --> J{OTP requested in last 180 seconds?}
	J -- Yes --> K[Return retryAfterSeconds]
	J -- No --> L[Create login OTP and send email]
	L --> M[User enters 6-digit OTP]
	M --> N[POST /accounts/auth/login/verify-otp/]
	N --> O{OTP valid and not expired?}
	O -- No --> P[Return invalid or expired OTP]
	O -- Yes --> H
	H --> Q[Return user payload with role flags]
	Q --> R[Store auth state in localStorage or sessionStorage]
	R --> S{hasDashboardAccess?}
	S -- Yes --> T[Redirect to /admin-dashboard]
	S -- No --> U[Redirect to /landing]
```

## Password Reset

```mermaid
flowchart TD
	A[User opens Forgot Password modal] --> B[Enter registered email]
	B --> C[POST /accounts/auth/password-reset/]
	C --> D{Email valid and account exists?}
	D -- No --> E[Return error]
	D -- Yes --> F{Reset OTP requested in last 180 seconds?}
	F -- Yes --> G[Return retryAfterSeconds]
	F -- No --> H[Create password reset OTP and send email]
	H --> I[User enters OTP and new password]
	I --> J[POST /accounts/auth/password-reset/confirm/]
	J --> K{OTP valid and password acceptable?}
	K -- No --> L[Return error]
	K -- Yes --> M[Update Django password]
	M --> N[Mark OTP as used]
	N --> O[Return success message]
	O --> P[User signs in with new password]
```
