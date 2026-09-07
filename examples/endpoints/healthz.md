# Liveness

`GET /healthz`

Liveness probe. Public (no auth).

**Auth:** none (public).

## Example

```bash
curl -sS -X GET http://localhost:8080/healthz
```

## Responses

### `200`

```json
{
  "status": "ok",
  "version": "2026.9.0"
}
```
