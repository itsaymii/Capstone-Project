# 📡 API Documentation

## GET /accounts/test
Returns system status.

## POST /accounts/incidents
Create new incident report.

### Request Body
```json
{
  "title": "Car Accident",
  "description": "Two vehicles collision",
  "latitude": 13.94,
  "longitude": 121.61
}
