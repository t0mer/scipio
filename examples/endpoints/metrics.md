# Prometheus metrics

`GET /metrics`

Prometheus metrics (text/plain). Public (no auth). Labels are limited to companyId and status — never account numbers or credentials.

**Auth:** none (public).

## Example

```bash
curl -sS -X GET http://localhost:8080/metrics
```

## Responses

### `200`

```
# HELP scipio_scrapes_total Total scrapes by company and outcome status.
# TYPE scipio_scrapes_total counter
scipio_scrapes_total{company="leumi",status="succeeded"} 3
# HELP scipio_queue_depth Number of jobs currently queued (pending).
# TYPE scipio_queue_depth gauge
scipio_queue_depth 0
```
