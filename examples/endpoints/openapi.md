# OpenAPI document

`GET /openapi.json`

The generated OpenAPI 3.1 document. Public (no auth). Swagger UI is served at /docs.

**Auth:** none (public).

## Example

```bash
curl -sS -X GET http://localhost:8080/openapi.json
```

## Responses

### `200`

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Scipio",
    "version": "2026.9.0"
  },
  "paths": {
    "/api/v1/scrape": {
      "…": "…"
    }
  }
}
```
