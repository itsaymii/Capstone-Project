# Incident and Evacuation Flows

## From Responder Report to Incident

```mermaid
sequenceDiagram
    actor Responder
    participant FE as Frontend
    participant API as Django API
    participant DB as Database
    actor Admin
    participant SMS as SMS gateway

    Responder->>FE: Create Report (3 steps: Overview, Victims, Operation Log)
    FE->>API: POST /api/incidents/incident-reports/ (status Pending)
    API->>API: Check coordinates are inside Lucena City
    API->>DB: Save report (IR-YYYY-NNNNN, INC-YYYY-NNNNN) and victims
    Admin->>FE: Review report on the admin map
    FE->>API: PATCH report status to Approved
    API->>DB: Create Incident with the same INC code, plus type details
    alt Severity is critical and it happened within 24 hours
        API->>SMS: Alert every citizen with a phone number
    end
    FE->>API: Load incidents and reports
    API-->>FE: Dashboard, map, analytics, and reports update
```

**When a report is approved** (`backend/incidents/signals.py`):

| Report incident type | Hazard type created |
|---|---|
| Fire Incident | Fire |
| RCA / vehicular / accident | Vehicular Accident |
| Crime Against Person/Property | Crime |
| Drowning | Drowning |
| Medical Emergency, Ambulance Assistance, Stand-by Medical Team | Medical Emergency |

| Severity | Rule |
|---|---|
| Critical | 5 or more victims |
| High | 3 or 4 victims |
| Moderate | Fire, drowning, or crime; or at least 1 victim |
| Low | Everything else |

The new incident gets status **Verified** and the report's barangay (or the nearest barangay to its coordinates). Only one incident is created per report, even if it is approved again.

**Accomplishment reports:** responders compile their approved reports into an accomplishment report (`POST /api/incidents/accomplishment-reports/`). Admins see these on the Accomplishment page and can print or export them.

## Nearest Evacuation Centers

Only logged-in users get recommendations. Logged-out visitors see the map of all centers.

```mermaid
flowchart TD
    A[Logged-in user opens /evacuation] --> B[Browser asks for approximate location]
    B -- Denied --> X[Message: allow location to see nearby centers]
    B -- Allowed --> C["GET /api/resources/evacuation-centers/nearby/?latitude=..&longitude=..&limit=5"]
    C --> D[Sort all centers by distance]
    D --> E[Take the 5 closest that are Available]
    E --> F{Fewer than 5 Available?}
    F -- Yes --> G[Fill the list with the closest other centers, marked as not accepting]
    F -- No --> H[Show 5 centers with distance,<br/>occupancy, spaces left, and directions]
    G --> H
    D --> I[Also list closer centers that are Full, Closed,<br/>or Under Maintenance, so people know not to go there]
```

**Status rules** (`backend/resources/evacuation.py`, applied every time a center is saved):

| Situation | Status |
|---|---|
| Capacity is set and occupancy reaches capacity | Full (automatic) |
| Capacity is set and occupancy is below capacity | Available (automatic) |
| Admin sets Closed or Under Maintenance | Kept as set, never changed automatically |
| Capacity not set (0) | Whatever the admin chose; residents see "Capacity not set" |

Occupancy can never be saved higher than capacity. If the `/nearby/` request fails, the browser works out the same list from the full center list.