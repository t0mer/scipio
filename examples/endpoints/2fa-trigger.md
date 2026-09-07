# Trigger OTP (OneZero)

`POST /api/v1/2fa/trigger`

OneZero: sends an OTP code to the given phone number and opens a short-lived 2FA session.

**Auth:** required (`Authorization: Bearer <token>` or `X-API-Token: <token>`).

**Rate limited:** yes (job/scrape creation).

## Example

```bash
curl -sS -X POST http://localhost:8080/api/v1/2fa/trigger \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyId":"oneZero","phoneNumber":"972500000000"}'
```

## Request body

```json
{
  "companyId": "oneZero",
  "phoneNumber": "972500000000"
}
```

## Responses

### `200`

```json
{
  "success": true
}
```

### `429`

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded, retry in 1 minute"
  }
}
```
