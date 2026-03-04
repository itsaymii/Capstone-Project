# 🏗 System Architecture

```mermaid
graph TD
A[Citizen / Responder] --> B[React Frontend]
B -->|REST API| C[Django Backend]
C --> D[Database]
C -->|JSON Response| B
B --> E[Interactive Map]
