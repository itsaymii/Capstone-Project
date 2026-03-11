# 🔄 Incident Reporting Flow

```mermaid
sequenceDiagram
participant User
participant Frontend
participant Backend
participant Database

User->>Frontend: Fill Incident Form
Frontend->>Frontend: Capture GPS Location
Frontend->>Backend: POST /accounts/incidents
Backend->>Database: Save Data
Database-->>Backend: Success
Backend-->>Frontend: Return JSON
Frontend->>Frontend: Plot on Map
