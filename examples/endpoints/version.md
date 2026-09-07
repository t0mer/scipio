# Version

`GET /version`

Service version, wrapped library version, and build commit. Public (no auth).

**Auth:** none (public).

## Example

```bash
curl -sS -X GET http://localhost:8080/version
```

## Responses

### `200`

```json
{
  "version": "2026.9.0",
  "libraryVersion": "6.11.0",
  "commit": "abc1234"
}
```
