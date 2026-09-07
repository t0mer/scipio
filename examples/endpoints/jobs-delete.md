# Cancel or delete a job

`DELETE /api/v1/jobs/{jobId}`

Cancels an in-flight job (best effort) or deletes a finished one.

**Auth:** required (`Authorization: Bearer <token>` or `X-API-Token: <token>`).

## Example

```bash
curl -sS -X DELETE http://localhost:8080/api/v1/jobs/{jobId} \
  -H "Authorization: Bearer $API_TOKEN"
```

## Responses

### `204` — Deleted (no body).

_No body._

### `404`

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Job not found."
  }
}
```
