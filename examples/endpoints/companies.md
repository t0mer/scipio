# List companies

`GET /api/v1/companies`

Returns supported companies, their login fields, 2FA requirement, and accepted opt-in features. Served at runtime from the library.

**Auth:** required (`Authorization: Bearer <token>` or `X-API-Token: <token>`).

## Example

```bash
curl -sS -X GET http://localhost:8080/api/v1/companies \
  -H "Authorization: Bearer $API_TOKEN"
```

## Responses

### `200`

```json
{
  "companies": [
    {
      "companyId": "leumi",
      "name": "Bank Leumi",
      "loginFields": [
        "username",
        "password"
      ],
      "requiresTwoFactor": false
    },
    {
      "companyId": "oneZero",
      "name": "One Zero",
      "loginFields": [
        "email",
        "otpCodeRetriever",
        "otpLongTermToken",
        "password",
        "phoneNumber"
      ],
      "requiresTwoFactor": true
    }
  ],
  "optInFeatures": [
    "isracard-amex:skipAdditionalTransactionInformation",
    "mizrahi:pendingIfNoIdentifier",
    "mizrahi:pendingIfHasGenericDescription",
    "mizrahi:pendingIfTodayTransaction"
  ]
}
```
