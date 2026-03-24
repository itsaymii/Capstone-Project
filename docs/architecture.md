# System Architecture

This diagram shows the high-level structure of the system.

```mermaid
flowchart TD
	U[Citizen or Responder] --> FE[React Frontend]
	FE -->|REST API| BE[Django Backend]
	BE --> DB[(Database)]
	BE -->|JSON Response| FE
	FE --> MAP[Interactive Map]
```
