# Exchange OTP for a long-term token (OneZero)

`POST /api/v1/2fa/long-term-token`

OneZero: exchanges the OTP code (from a prior /2fa/trigger) for a reusable long-term token. Store it client-side and pass it as `otpLongTermToken`.

**Auth:** required (`Authorization: Bearer <token>` or `X-API-Token: <token>`).

**Rate limited:** yes (job/scrape creation).

## Example

```bash
curl -sS -X POST http://localhost:8080/api/v1/2fa/long-term-token \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyId":"oneZero","otpCode":"123456"}'
```

## Request body

```json
{
  "companyId": "oneZero",
  "otpCode": "123456"
}
```

## Responses

### `200`

```json
{
  "longTermTwoFactorAuthToken": "eyJhbGciOi...LONG"
}
```

### `400` — OTP rejected by the bank.

```json
{
  "error": {
    "code": "OTP_REJECTED",
    "message": "Invalid OTP code"
  }
}
```

### `409` — No active 2FA session — call /2fa/trigger first.

```json
{
  "error": {
    "code": "NO_2FA_SESSION",
    "message": "No active 2FA session for this company. Call POST /2fa/trigger first."
  }
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
