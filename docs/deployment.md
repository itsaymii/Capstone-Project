# Deployment Architecture

This diagram shows the runtime deployment setup.

```mermaid
flowchart TD
	UB[User Browser] --> FH[Frontend Hosting]
	FH --> BS[Backend Server]
	BS --> DB[(Database)]
```
