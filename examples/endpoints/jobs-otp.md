# Submit OTP for a job

`POST /api/v1/jobs/{jobId}/otp`

Submits the OTP code for a OneZero job that is `waiting_for_otp`. The job resumes on submission.

**Auth:** required (`Authorization: Bearer <token>` or `X-API-Token: <token>`).

## Example

```bash
curl -sS -X POST http://localhost:8080/api/v1/jobs/{jobId}/otp \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"otpCode":"123456"}'
```

## Request body

```json
{
  "otpCode": "123456"
}
```

## Responses

### `204` — Accepted (no body).

_No body._

### `409` — Job is not waiting for an OTP code.

```json
{
  "error": {
    "code": "NOT_WAITING_FOR_OTP",
    "message": "Job is not waiting for an OTP code."
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
