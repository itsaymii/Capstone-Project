# Lucena City DRRMO – Disaster Risk Management System

A web system for the Lucena City Disaster Risk Reduction and Management Office. It collects incident reports from field responders, lets admins review and analyze them, shows hazards and evacuation centers on a map, and helps residents find the nearest open evacuation center.

## Features

**Residents (citizens)**
- Register with email OTP; accounts are activated after an admin verifies Lucena City residency
- Disaster map, emergency hotlines, and disaster-preparedness simulation courses with quizzes and certificates
- Evacuation page: map of all centers; when logged in, the 5 nearest centers that are accepting evacuees, with capacity and occupancy

**Responders (staff)**
- 3-step incident report: Incident Overview → Victim Profiling → Operation Log, with GPS location
- View submitted reports and incidents

**Admins**
- Dashboard with incident trends, type distribution, and barangay hotspots
- Incidents and Accomplishment reports, approval of responder reports
- GIS map, barangay risk scoring, analytics, and live earthquake data (USGS)
- Evacuation centers: capacity, occupancy, and status (Available, Full, Closed, Under Maintenance)
- User management, simulation course management, and printable/exportable reports (PDF, CSV)
- SMS alerts to residents for critical incidents

## Tech Stack

| Part | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 3, React Leaflet |
| Backend | Django 6, Django REST Framework |
| Database | SQLite (`backend/db.sqlite3`, not stored in Git) |
| External services | USGS earthquake feed, OpenStreetMap tiles, Gmail SMTP (OTP), SMS gateway, Gemini API (risk insights) |

## Project Structure

```
Capstone-Project/
├── backend/                  Django project
│   ├── config/               settings and URLs
│   ├── accounts/             login, registration, OTP, roles
│   ├── incidents/            incidents, responder reports, accomplishment reports
│   ├── resources/            evacuation centers, equipment, supplies
│   ├── locations/            barangays
│   ├── analytics/            risk scores and insights
│   ├── dashboard/            simulation courses, quizzes, certificates
│   ├── sms/                  SMS alerts
│   └── evacuations_centers.csv   99 Lucena evacuation centers (sample import file)
├── frontend/                 React app
│   └── src/
│       ├── pages/            admin-dashboard, responder, evacuation, auth, ...
│       ├── components/
│       ├── services/         API calls
│       └── types/
├── docs/                     diagrams and full system documentation
└── lucena_barangays.geojson  33 Lucena barangay boundaries
```

## Requirements

- Python 3.12 or newer
- Node.js 20.19 or newer
- Git

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
```

Create `backend/.env` with at least:

```env
SECRET_KEY=change-this-to-any-long-random-text
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Needed for OTP emails (use a Gmail App Password, not your normal password)
EMAIL_HOST_USER=yourgmail@gmail.com
EMAIL_HOST_PASSWORD=your_16_character_app_password

# Optional
SMS_BASE_URL=
SMS_USERNAME=
SMS_PASSWORD=
GEMINI_API_KEY=
```

Then create the database and an admin account:

```bash
python manage.py migrate
python manage.py import_barangays ../lucena_barangays.geojson
python manage.py createsuperuser
python manage.py runserver
```

The API runs at http://127.0.0.1:8000.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The frontend reads the API address from `frontend/.env` (`VITE_API_BASE_URL=http://127.0.0.1:8000`).

> Use port 5173 for the frontend. The backend only accepts requests (CORS/CSRF) from `localhost:5173` and `127.0.0.1:5173`.

## Accounts and Roles

| Role | How to create | Where they land after login |
|---|---|---|
| Admin | `python manage.py createsuperuser` | `/admin-dashboard` |
| Staff / Responder | `python manage.py create_staff_user email@example.com --password YourPass123 --name "Alpha Team"`, or from the admin Users page | `/responder-dashboard` |
| Citizen | Register at `/register` (email OTP), then an admin approves residency | Landing page |

Admins and staff log in at `/login` without an OTP. Citizens receive an OTP by email.

## Loading Data

| Data | How |
|---|---|
| Barangays | `python manage.py import_barangays ../lucena_barangays.geojson` |
| Evacuation centers | Admin Dashboard → Resources → Upload CSV, using `backend/evacuations_centers.csv`. Optional columns: `capacity`, `current_occupancy`, `status` |
| Sample incident reports | `python manage.py generate_accomplishment_reports --count 200 --approved` (the reports are spread over the existing responder accounts) |
| Fill Incidents, Accomplishment, and Scoring pages from existing data | `python manage.py prepare_dashboard_data` (add `--shift-dates` to move old sample data up to today) |
| Recalculate risk scores | `python manage.py calculate_risk_scores --days 365` |
| Sync Lucena-area earthquakes | `python manage.py sync_earthquake_events --days 90` |

For fresh citywide earthquake-risk data, create a **daily Windows Task Scheduler** task at 03:00 (Asia/Manila). Set its action to:

- **Program:** `C:\path\to\Capstone-Project\backend\.venv\Scripts\python.exe`
- **Arguments:** `manage.py sync_earthquake_events --days 90`
- **Start in:** `C:\path\to\Capstone-Project\backend`

Run the task under an account that can access the project, its `.env`, and the same `backend\db.sqlite3` used by the web app. Re-syncing 90 days daily also picks up revised USGS event data after missed runs.

## Tests

```bash
cd backend
python manage.py test

cd frontend
npm run lint
npm run build
```

## Team Workflow

1. Always update before starting: `git checkout main` then `git pull origin main`.
2. Create a branch for your change (e.g. `fix/login-otp`), commit, push, and open a Pull Request to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).
3. Never commit `db.sqlite3`, `__pycache__/`, `.pyc` files, `node_modules/`, or `backend/.env`. Each member keeps their own database and passwords.
4. After pulling, run `python manage.py migrate` (backend) and `npm install` (frontend) in case something changed.

## Documentation

- [System Documentation](docs/SYSTEM-DOCUMENTATION.md): users, pages, rules, API endpoints, known issues
- [System Architecture](docs/architecture.md)
- [Authentication Flow](docs/authentication-flow.md)
- [Incident and Evacuation Flows](docs/system-flow.md)
- [Database ERD](docs/erd.md)
