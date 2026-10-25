# Authentication Flow

One login page (`/login`) for all roles. Citizens confirm logins with an email OTP; admins and staff skip the OTP. Citizens must also be verified as Lucena City residents by an admin.

| Rule | Value |
|---|---|
| OTP length / validity | 6 digits, valid for 3 minutes |
| Wait before requesting a new OTP | 180 seconds |
| Skip OTP if a login OTP was verified recently | within 5 minutes |
| Session right after registration (residency still pending) | 24 hours |
| Residency proof upload | JPG or PNG, up to 5 MB |

Code: `backend/accounts/views.py`, `frontend/src/services/auth.ts`, `frontend/src/pages/auth/`.

## Citizen Registration and Residency Verification

```mermaid
flowchart TD
    A[Fill in name, email, phone, password,<br/>Lucena barangay, address, proof of residency] --> B[POST /accounts/auth/register/]
    B --> C{Valid details and<br/>email not yet used?}
    C -- No --> X[Show error]
    C -- Yes --> D[Save residency request as Pending<br/>and email a registration OTP]
    D --> E[User enters OTP]
    E --> F[POST /accounts/auth/register/verify-otp/]
    F --> G{OTP valid?}
    G -- No --> X
    G -- Yes --> H[Create account with Citizen role<br/>and log in for up to 24 hours]
    H --> I[Admin reviews in Admin Dashboard → Users]
    I --> J{Decision}
    J -- Verified --> K[Account active: can log in normally]
    J -- Rejected, with reason --> L[Account blocked from logging in]
```

## Login

```mermaid
flowchart TD
    A[Email or username + password] --> B[POST /accounts/auth/login/]
    B --> C{Password correct and account active?}
    C -- No --> X[Show error]
    C -- Yes --> D{Residency request pending or rejected?}
    D -- Yes --> X2[Block login and explain why]
    D -- No --> E{Admin or staff?}
    E -- Yes --> S[Start session]
    E -- No --> F{Login OTP verified<br/>in the last 5 minutes?}
    F -- Yes --> S
    F -- No --> G{OTP requested in<br/>the last 180 seconds?}
    G -- Yes --> W[Ask user to wait]
    G -- No --> H[Email a login OTP]
    H --> I[POST /accounts/auth/login/verify-otp/]
    I --> J{OTP valid and not expired?}
    J -- No --> X
    J -- Yes --> S
    S --> R{Role}
    R -- Admin --> RA["/admin-dashboard"]
    R -- Staff / responder --> RR["/responder-dashboard"]
    R -- Citizen --> RC["/landing (or the page they came from)"]
```

## Password Reset

```mermaid
flowchart TD
    A[Forgot password: enter registered email] --> B[POST /accounts/auth/password-reset/]
    B --> C{Account exists and<br/>no OTP sent in last 180 s?}
    C -- No --> X[Show error or wait time]
    C -- Yes --> D[Email a reset OTP]
    D --> E[Enter OTP and new password]
    E --> F[POST /accounts/auth/password-reset/confirm/]
    F --> G{OTP valid and password at least 6 characters?}
    G -- No --> X
    G -- Yes --> H[Save new password and mark OTP as used]
    H --> I[Log in with the new password]
```