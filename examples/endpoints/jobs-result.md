# Get job result

`GET /api/v1/jobs/{jobId}/result`

Returns the full scrape result once the job is terminal (`succeeded` or `failed`).

**Auth:** required (`Authorization: Bearer <token>` or `X-API-Token: <token>`).

## Example

```bash
curl -sS -X GET http://localhost:8080/api/v1/jobs/{jobId}/result \
  -H "Authorization: Bearer $API_TOKEN"
```

## Responses

### `200`

```json
{
  "success": true,
  "accounts": [
    {
      "accountNumber": "12345678",
      "balance": 1234.56,
      "txns": [
        {
          "type": "normal",
          "identifier": "REF-0001",
          "date": "2024-01-03T00:00:00.000Z",
          "processedDate": "2024-01-03T00:00:00.000Z",
          "originalAmount": -49.9,
          "originalCurrency": "ILS",
          "chargedAmount": -49.9,
          "description": "Coffee shop",
          "status": "completed"
        }
      ]
    }
  ]
}
```

### `409` — Job not terminal yet.

```json
{
  "error": {
    "code": "NOT_READY",
    "message": "Job result is not ready yet."
  }
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
