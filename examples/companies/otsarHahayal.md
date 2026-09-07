# Bank Otsar Hahayal — `otsarHahayal`

Company metadata and credential contract for **Bank Otsar Hahayal**.

- **companyId:** `otsarHahayal`
- **Requires 2FA:** no

## Login fields

| Field | Required | Notes |
|---|---|---|
| `username` | yes | Username. |
| `password` | yes | Account password. |

## Credentials object

```json
{
  "companyId": "otsarHahayal",
  "username": "my-username",
  "password": "your-password"
}
```

## Example: synchronous scrape

```bash
curl -sS -X POST http://localhost:8080/api/v1/scrape \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credentials":{"companyId":"otsarHahayal","username":"my-username","password":"your-password"},"options":{"startDate":"2024-01-01"}}'
```

Request body:

```json
{
  "credentials": {
    "companyId": "otsarHahayal",
    "username": "my-username",
    "password": "your-password"
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

See also: [endpoints/scrape.md](../endpoints/scrape.md), [endpoints/jobs-create.md](../endpoints/jobs-create.md).
