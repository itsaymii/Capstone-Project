# System Architecture

## Overview

```mermaid
flowchart LR
    subgraph Users
        C[Residents]
        R[Responders]
        A[Admins]
    end

    subgraph FE[Frontend: React + Vite, port 5173]
        P[Pages by role]
        S[services/ API calls]
    end

    subgraph BE[Backend: Django REST, port 8000]
        ACC[accounts<br/>login, OTP, roles, residency]
        INC[incidents<br/>incidents, reports, accomplishment]
        RES[resources<br/>evacuation centers]
        LOC[locations<br/>barangays]
        ANA[analytics<br/>risk scores, insights]
        DSH[dashboard<br/>admin users, simulation, cached briefing]
        SMS[sms<br/>critical alerts]
    end

    DB[(SQLite<br/>db.sqlite3)]

    C & R & A --> P
    P --> S
    S -->|REST / JSON, session cookie| BE
    BE --> DB

    subgraph EXT[Loaded directly by the browser]
        USGS[USGS earthquake feed]
        OSM[OpenStreetMap map tiles]
    end
    P -.-> EXT
    ACC -.->|OTP emails| SMTP[Gmail SMTP]
    SMS -.->|text messages| GW[SMS gateway]
    DSH -.->|Strategic briefing, template fallback| GEM[Google Gemini]
```

- The browser talks only to the Django API, except for earthquake data (USGS) and map tiles (OpenStreetMap), which it loads directly.
- Login uses Django sessions. The backend only accepts requests from `localhost:5173` and `127.0.0.1:5173` (CORS and CSRF settings in `backend/config/settings.py`).
- The admin dashboard's Strategic Quarterly Briefing uses incidents from the last 30 days and is cached for 30 days. If Gemini is not configured or fails, deterministic template text is used.

## Running Environment

The system currently runs locally. Each team member has their own database.

```mermaid
flowchart TD
    B[Browser] -->|http://localhost:5173| V[Vite dev server<br/>npm run dev]
    B -->|http://127.0.0.1:8000| D[Django dev server<br/>python manage.py runserver]
    D --> F[(backend/db.sqlite3)]
    D --> M[backend/media<br/>uploaded residency documents, quiz PDFs]
```

`db.sqlite3` and `.env` are not stored in Git. `media/` should not be either, because it holds residents' uploaded documents.