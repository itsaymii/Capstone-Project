# DRMS – System Documentation

Disaster Risk Management System for the Lucena City Disaster Risk Reduction and Management Office (DRRMO).

For setup and run instructions, see the main [README](../README.md). Diagrams: [architecture](architecture.md), [authentication](authentication-flow.md), [incident and evacuation flows](system-flow.md), [database](erd.md).

## Contents

1. [Users and Roles](#1-users-and-roles)
2. [Pages](#2-pages)
3. [Backend Modules](#3-backend-modules)
4. [Main Rules](#4-main-rules)
5. [API Reference](#5-api-reference)
6. [Frontend Structure](#6-frontend-structure)
7. [Known Issues and To-Do](#7-known-issues-and-to-do)

## 1. Users and Roles

| Role | Who | Stored as | Logs in with |
|---|---|---|---|
| Admin | DRRMO office staff managing the system | `AccountProfile.role = admin` or Django superuser | Password only |
| Staff / Responder | Field response teams (Alpha, Bravo, Charlie) | `AccountProfile.role = staff` | Password only |
| Citizen | Lucena City residents | `AccountProfile.role = citizen` | Password + email OTP, after residency is verified |

Everyone uses the same login page (`/login`) and is sent to the right dashboard by role. Details: [Authentication Flow](authentication-flow.md).

## 2. Pages

### Public and citizen pages

| Page | Route | Login needed | What it does |
|---|---|---|---|
| Landing | `/`, `/landing` | No | Home page and links |
| Login / Register | `/login`, `/register` | No | Login with OTP, registration with residency proof, password reset |
| Disaster Map | `/disaster-map` | No | Incidents, earthquakes, and fault lines on a map |
| Evacuation | `/evacuation` | Map: no. Nearest centers: yes | All evacuation centers; logged-in users also get the 5 nearest centers accepting evacuees |
| Emergency Hotlines | `/emergency-hotlines` | No | Emergency phone numbers |
| Simulation | `/simulation` | For progress and certificates | Preparedness courses with lessons, quizzes, and certificates |

### Responder pages (staff)

| Page | Route | What it does |
|---|---|---|
| Responder Dashboard | `/responder-dashboard` | Latest reports and shortcuts |
| Create Report | `/create-report` | 3-step report: Incident Overview, Victim Profiling, Operation Log |
| Incidents | `/responder-incidents` | Own reports; compile approved ones into an accomplishment report |
| Reports | `/responder-reports` | Accomplishment reports |
| Profile | `/responder-profile-settings` | Profile settings |

### Admin dashboard (`/admin-dashboard?section=...`)

| Section | `section=` | What it does |
|---|---|---|
| Dashboard | *(none)* | Totals, risk scores, incident trend by month, type distribution, top barangays |
| Mapping | `map` | Incident map; approve responder reports |
| Incidents | `incidents` | Responder incident reports with filters by team and date |
| Accomplishment | `accomplishment` | Accomplishment reports compiled by responders; print |
| Scoring | `scoring` | Barangay risk score, predicted hazard, AI insight |
| Analytics | `trends` | Incident and earthquake analytics |
| Resources | `resources` | Evacuation centers: capacity, occupancy, status, CSV upload; vehicle maintenance |
| Users | `users` | Create, edit, delete accounts; verify or reject residency |
| Simulation | `simulation` | Courses, quiz PDFs, certificates |
| Reports | `reports` | One table of fire, accident, earthquake, and responder reports; PDF, print, CSV |
| Settings | `settings` | Placeholder (no settings yet) |

## 3. Backend Modules

| App | URL prefix | Responsibility |
|---|---|---|
| `accounts` | `/accounts/` | Registration, OTP, login, password reset, roles, residency verification |
| `dashboard` | `/dashboard/` | Admin account management, simulation courses, quizzes, certificates |
| `incidents` | `/api/incidents/` | Hazard types, incidents, incident reports, victims, accomplishment reports |
| `resources` | `/api/resources/` | Evacuation centers, supplies, equipment, volunteers |
| `locations` | `/api/locations/` | Barangays, locations, population density, fault lines |
| `analytics` | `/api/analytics/` | Barangay risk scores, hazard predictions, AI insights |
| `sms` | (no URLs) | Sends SMS alerts to citizens for critical incidents |

Django admin is at `/admin/`.

## 4. Main Rules

**Login and OTP** – 6-digit codes valid for 3 minutes; 180 seconds before a new one can be sent; no OTP again if one was verified in the last 5 minutes. Admins and staff never need an OTP. See [Authentication Flow](authentication-flow.md).

**Residency** – Citizens upload a JPG/PNG proof (max 5 MB) and choose a Lucena barangay. They cannot log in again until an admin marks them Verified. A rejection requires a reason and blocks the account.

**Report locations** – Incident reports must have coordinates inside Lucena City: latitude 13.89–13.98, longitude 121.57–121.69.

**Report → incident** – When an admin approves a responder report, an Incident is created automatically with the same `INC-` code, the matching hazard type, and a severity based on the number of victims. See [Incident and Evacuation Flows](system-flow.md).

**SMS alerts** – Sent to every citizen with a phone number (starting `09` or `+63`) when an incident is created as, or changed to, **critical**, but only if it happened in the last 24 hours. Messages are logged in `SMSLog`; an approved report is not alerted twice.

**Evacuation centers** – Full and Available follow capacity and occupancy automatically; Closed and Under Maintenance are manual. Occupancy cannot exceed capacity. The nearest-center list shows 5 centers that are accepting evacuees. See [Incident and Evacuation Flows](system-flow.md).

**Risk score (per barangay, 1–10)** – `backend/analytics/scoring.py`

```
score = 0.4 × frequency + 0.4 × severity + 0.2 × recency      (each part 0–10)
frequency = number of incidents ÷ 5 (max 10)
severity  = average severity (low 1 … critical 4), scaled to 10
recency   = share of incidents in the last 30 days × 10
```

Default window is the last 90 days. Stored scores are refreshed with `python manage.py calculate_risk_scores`.

**Hazard prediction** – The hazard type with the highest frequency × severity in a barangay is predicted as the most likely to happen again in the next 30 days (`backend/analytics/prediction.py`).

**AI insights** – Written by Google Gemini when `GEMINI_API_KEY` is set; otherwise a template is used (`backend/analytics/insights.py`).

## 5. API Reference

Base URL in development: `http://127.0.0.1:8000`. Requests use the Django session cookie; send the CSRF token (`/accounts/auth/csrf/`) for POST, PUT, PATCH, and DELETE.

### Accounts – `/accounts/auth/`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `csrf/` | Get the CSRF cookie |
| POST | `register/`, `register/verify-otp/` | Register a citizen, then confirm with OTP |
| POST | `login/`, `login/verify-otp/` | Log in, then confirm with OTP (citizens) |
| GET, PATCH | `profile/` | Current user's profile |
| POST | `password-reset/`, `password-reset/confirm/` | Request and confirm a password reset |

### Admin and simulation – `/dashboard/`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `admin/summary/` | Dashboard totals |
| GET / POST | `admin/accounts/` / `admin/accounts/create/` | List / create accounts |
| PUT, PATCH, DELETE | `admin/accounts/<id>/` | Edit or delete an account |
| PATCH | `admin/accounts/<id>/residency-verification/` | Verify or reject residency (`status`, `rejectionReason`) |
| GET / GET, PUT | `simulation/courses/` / `simulation/progress/` | Courses / the user's progress |
| GET / POST | `simulation/quizzes/module/` / `simulation/quizzes/<id>/submit/` | Load / submit a quiz |
| POST / GET | `simulation/certificates/request/` / `simulation/certificates/mine/` | Request / list certificates |
| various | `admin/simulation/...` | Manage courses, quizzes (PDF upload, publish), certificates |

### Incidents – `/api/incidents/`

| Method | Endpoint | Purpose |
|---|---|---|
| GET, POST | `incidents/` | Incidents (filters: `status`, `severity`, `hazard_type`, `barangay`, `reference_code`) |
| GET | `incidents/lookup/<INC-code>/` | Find an incident by reference code |
| GET, POST, PATCH | `incident-reports/` | Responder reports (filters: `search`, `hazard_type`, `from_date`, `to_date`); PATCH `status` to approve |
| GET, POST | `accomplishment-reports/` | Compiled accomplishment reports |
| GET | `hazard-types/`, `alerts/` | Hazard types and alerts |

### Resources – `/api/resources/`

| Method | Endpoint | Purpose |
|---|---|---|
| GET, POST, PATCH, DELETE | `evacuation-centers/` | Evacuation centers (staff/admin can edit) |
| GET | `evacuation-centers/nearby/?latitude=&longitude=&limit=5` | Nearest centers accepting evacuees |
| GET | `evacuation-centers/nearest/?latitude=&longitude=` | Single nearest center |
| GET | `evacuation-centers/geojson/` | Centers as GeoJSON |
| POST | `evacuation-centers/import-csv/` | Upload a CSV (`name, latitude, longitude`, optional `address, barangay, capacity, current_occupancy, status`) |
| GET, POST, PATCH | `supplies/`, `equipment/`, `volunteers/`, `summary/` | Other resources |

### Locations and analytics

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/locations/barangays/` | Barangays with boundaries |
| GET | `/api/locations/fault-lines/`, `population-density/` | Map layers |
| GET | `/api/analytics/barangay-risk/?barangay_id=&days=90` | Risk score, prediction, trends for one barangay |
| GET | `/api/analytics/hazard-insights/?hazard=Fire&days=365` | City-wide stats and AI insight for a hazard |

## 6. Frontend Structure

```
frontend/src/
├── routes/        AppRouter.tsx (all routes), ProtectedRoute.tsx (role checks)
├── pages/         admin-dashboard/, responder/, evacuation/, auth/, disaster-map/, simulation/, ...
├── components/    Sidebars, nav bars, admin map panel, simulation managers
├── services/      api.ts (axios client + most API calls), auth.ts, incidents.ts, earthquakes.ts
├── data/          adminOperations.ts (incident mapping), evacuation.ts (status and occupancy display rules)
└── types/         api.ts (API response types)
```

- The API address comes from `VITE_API_BASE_URL` in `frontend/.env`.
- Logged-in user info is kept in browser storage and refreshed from `/accounts/auth/profile/`.
- Earthquakes come straight from the USGS feed (Philippines, last 2 years).

## 7. Known Issues and To-Do

| Issue | Where | Effect |
|---|---|---|
| API address hard-coded as `http://127.0.0.1:8000` | `pages/responder/CreateReport.tsx`, `ResponderReportsPage.tsx`, `ResponderIncidentsPage.tsx` | Responders cannot submit reports from another device (e.g. a phone) |
| Incident and accomplishment report APIs allow anyone (`AllowAny`, "temporary for testing") | `backend/incidents/views.py` | Should be limited to logged-in staff before deployment |
| Residency proof files are in the repository | `backend/media/` | Personal documents should be removed from Git and `media/` ignored |
| `.env.example` describes PostgreSQL/GDAL settings that are not used | `backend/.env.example` | Settings actually use SQLite; follow the README instead |
| Settings section is a placeholder | Admin dashboard | No settings yet |