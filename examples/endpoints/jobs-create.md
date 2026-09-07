# Create a scrape job

`POST /api/v1/jobs`

Creates an asynchronous scrape job. Use this for long scrapes and for interactive 2FA (OneZero).

**Auth:** required (`Authorization: Bearer <token>` or `X-API-Token: <token>`).

**Rate limited:** yes (job/scrape creation).

## Example

```bash
curl -sS -X POST http://localhost:8080/api/v1/jobs \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credentials":{"companyId":"isracard","id":"012345678","card6Digits":"123456","password":"your-password"},"options":{"startDate":"2024-01-01"}}'
```

## Request body

```json
{
  "credentials": {
    "companyId": "isracard",
    "id": "012345678",
    "card6Digits": "123456",
    "password": "your-password"
  },
  "options": {
    "startDate": "2024-01-01"
  }
}
```

## Responses

### `202`

```json
{
  "jobId": "3f1c0b8e-1a2b-4c3d-9e8f-abc123456789",
  "status": "queued"
}
```

### `422` — oneZero without a token or phone number.

```json
{
  "error": {
    "code": "TWO_FACTOR_REQUIRED",
    "message": "oneZero requires otpLongTermToken or phoneNumber (for interactive OTP)."
  }
}
```

### `429`

```json
{
  "error": {
    "code": "QUEUE_FULL",
    "message": "Job queue is full; try again later."
  }
}
```
