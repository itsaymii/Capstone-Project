```mermaid
graph TD
A[User] --> B[React Frontend]
B -->|API Request| C[Django Backend]
C --> D[Database]
C -->|JSON Response| B