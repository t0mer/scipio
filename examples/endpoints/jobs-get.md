# Get job status

`GET /api/v1/jobs/{jobId}`

Returns the job status, progress events, and (while queued) its queue position. No financial data — fetch the result separately.

**Auth:** required (`Authorization: Bearer <token>` or `X-API-Token: <token>`).

## Example

```bash
curl -sS -X GET http://localhost:8080/api/v1/jobs/{jobId} \
  -H "Authorization: Bearer $API_TOKEN"
```

## Responses

### `200`

```json
{
  "jobId": "3f1c0b8e-1a2b-4c3d-9e8f-abc123456789",
  "companyId": "isracard",
  "status": "running",
  "createdAt": "2024-01-05T10:00:00.000Z",
  "updatedAt": "2024-01-05T10:00:03.000Z",
  "progress": [
    {
      "type": "START_SCRAPING",
      "at": "2024-01-05T10:00:01.000Z"
    },
    {
      "type": "LOGGING_IN",
      "at": "2024-01-05T10:00:02.000Z"
    }
  ]
}
```

### `200` — Queued job includes queuePosition (0 = next).

```json
{
  "jobId": "…",
  "companyId": "leumi",
  "status": "queued",
  "createdAt": "2024-01-05T10:00:00.000Z",
  "updatedAt": "2024-01-05T10:00:00.000Z",
  "queuePosition": 0,
  "progress": []
}
```

### `404`

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Job not found."
  }
}
```
