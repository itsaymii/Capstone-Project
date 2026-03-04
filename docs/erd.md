# 🗄 Database ERD

```mermaid
erDiagram
USER ||--o{ INCIDENT : submits
INCIDENT {
  int id
  string title
  string description
  float latitude
  float longitude
  datetime created_at
}
USER {
  int id
  string username
  string email
  string password
}

