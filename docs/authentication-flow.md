# 🔐 Authentication Flow

```mermaid
graph TD
A[User Login] --> B[React]
B --> C[Django JWT]
C --> D[Generate Access Token]
D --> B
B -->|Store Token| E[Protected Dashboard]
