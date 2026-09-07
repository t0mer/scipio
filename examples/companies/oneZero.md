# One Zero — `oneZero`

Company metadata and credential contract for **One Zero**.

> **Note.** Requires two-factor auth. Supply **`otpLongTermToken`** (from `POST /api/v1/2fa/long-term-token`) to scrape without a prompt, **or** `phoneNumber` to run the interactive OTP flow via an async job.

- **companyId:** `oneZero`
- **Requires 2FA:** yes (OTP)

## Login fields

| Field | Required | Notes |
|---|---|---|
| `email` | yes | Account email. |
| `password` | yes | Account password. |
| `phoneNumber` | conditional | Phone number for interactive OTP (async jobs). |
| `otpLongTermToken` | conditional | Long-term 2FA token; skips the OTP prompt. |

## Credentials object

```json
{
  "companyId": "oneZero",
  "email": "me@example.com",
  "password": "your-password",
  "otpLongTermToken": "eyJhbGciOi...LONG"
}
```

## Example: scrape with a long-term token

```bash
curl -sS -X POST http://localhost:8080/api/v1/scrape \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credentials":{"companyId":"oneZero","email":"me@example.com","password":"your-password","otpLongTermToken":"eyJhbGciOi...LONG"},"options":{"startDate":"2024-01-01"}}'
```

Request body:

```json
{
  "credentials": {
    "companyId": "oneZero",
    "email": "me@example.com",
    "password": "your-password",
    "otpLongTermToken": "eyJhbGciOi...LONG"
  },
  "options": {
    "startDate": "2024-01-01"
  }
}
```

Successful response (`200`), amounts are numbers or `null` if unparseable:

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

## Interactive OTP (async job)

Omit `otpLongTermToken` and supply `phoneNumber` to create a job that pauses at
`waiting_for_otp`. See [endpoints/jobs-otp.md](../endpoints/jobs-otp.md).

```json
{
  "credentials": {
    "companyId": "oneZero",
    "email": "me@example.com",
    "password": "your-password",
    "phoneNumber": "972500000000"
  },
  "options": {
    "startDate": "2024-01-01"
  }
}
```

See also: [endpoints/scrape.md](../endpoints/scrape.md), [endpoints/jobs-create.md](../endpoints/jobs-create.md).
