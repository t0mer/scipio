# Synchronous scrape

`POST /api/v1/scrape`

Runs a scrape and blocks until it finishes or the server-side timeout fires. Not usable for interactive 2FA companies (use the jobs flow). Bank-level failures return `200` with `success:false` and an `errorType`.

**Auth:** required (`Authorization: Bearer <token>` or `X-API-Token: <token>`).

**Rate limited:** yes (job/scrape creation).

## Example

```bash
curl -sS -X POST http://localhost:8080/api/v1/scrape \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credentials":{"companyId":"mizrahi","username":"012345678","password":"your-password"},"options":{"startDate":"2024-01-01","combineInstallments":false}}'
```

## Request body

```json
{
  "credentials": {
    "companyId": "mizrahi",
    "username": "012345678",
    "password": "your-password"
  },
  "options": {
    "startDate": "2024-01-01",
    "combineInstallments": false
  }
}
```

## Responses

### `200` — Scrape result (mirrors the library).

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

### `200` — Bank-level failure (still 200 — a scrape outcome, not an HTTP error).

```json
{
  "success": false,
  "errorType": "INVALID_PASSWORD",
  "errorMessage": "Invalid password"
}
```

### `400` — Validation error.

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Invalid credentials for 'mizrahi'. Required fields: username, password (and no others).",
    "details": {
      "companyId": "mizrahi",
      "requiredFields": [
        "username",
        "password"
      ]
    }
  }
}
```

### `422` — 2FA company on the sync endpoint.

```json
{
  "error": {
    "code": "TWO_FACTOR_REQUIRED",
    "message": "oneZero needs interactive 2FA; use the async jobs flow (POST /api/v1/jobs) or supply otpLongTermToken."
  }
}
```

### `429` — Rate limit exceeded.

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded, retry in 1 minute"
  }
}
```

### `504` — Server-side scrape timeout.

```json
{
  "error": {
    "code": "TIMEOUT",
    "message": "Scrape exceeded 240s."
  }
}
```
