# 📡 API Documentation

## GET /api/test
Returns system status.

## POST /api/incidents
Create new incident report.

### Request Body
```json
{
  "title": "Car Accident",
  "description": "Two vehicles collision",
  "latitude": 13.94,
  "longitude": 121.61
}
