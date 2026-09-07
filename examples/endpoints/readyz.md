# Readiness

`GET /readyz`

Readiness probe — reports whether Chromium is present and launchable. Public (no auth).

**Auth:** none (public).

## Example

```bash
curl -sS -X GET http://localhost:8080/readyz
```

## Responses

### `200`

```json
{
  "status": "ok",
  "chromium": true
}
```

### `503` — Chromium not available.

```json
{
  "status": "unavailable",
  "chromium": false
}
```
