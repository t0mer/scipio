# Scipio

A self-hosted **RESTful API around [israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers)**.
Fetch Israeli bank and credit-card transactions over HTTP — from n8n, Home
Assistant, budgeting importers, or any script — instead of embedding the npm
library.

Scipio is a **stateless proxy** in front of the banks: credentials pass through
per request and are **never persisted and never logged**.

- 100% of the library's features over REST (companies, options, opt-in features,
  2FA, future debits, progress reporting).
- Synchronous scrape **and** asynchronous jobs (scrapes take 30s–3min).
- Interactive **2FA/OTP** flow for OneZero, plus long-term-token helpers.
- OpenAPI 3.1 spec + Swagger UI, generated from the route schemas.
- Prometheus metrics; single multi-arch container (`linux/amd64`, `linux/arm64`).

> **Disclaimer.** Unofficial. Use at your own risk. Banks may lock accounts on
> repeated failed logins. Credentials go to **your own server** only. See
> [Security model](#security-model).

---

## Quick start

### Docker

```bash
docker run -d --name scipio \
  -p 8080:8080 \
  --shm-size=1g \
  -e API_TOKENS=change-me-please \
  techblog/scipio:latest
```

Open Swagger UI at <http://localhost:8080/docs>.

> `--shm-size=1g` is important — Chromium needs more shared memory than Docker's
> 64 MB default.

### docker compose

```bash
cp .env.example .env   # set API_TOKENS
docker compose up -d
```

See [`docker-compose.yml`](./docker-compose.yml) for the volume, `shm_size`, and
hardening (`cap_drop: [ALL]`, `no-new-privileges`).

### From source (development)

```bash
npm ci
npm run dev        # watch mode
# or
npm run build && npm start
```

Requires **Node.js 22+** and a Chromium binary (set `CHROMIUM_PATH`).

---

## Configuration

All configuration is via environment variables (12-factor). Precedence:
`ENV` → built-in default. Invalid configuration fails fast at boot.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `BIND` | `0.0.0.0` | Bind address (see auth rule below) |
| `API_TOKENS` | — | Comma-separated bearer tokens |
| `ALLOW_INSECURE` | `false` | Permit a tokenless non-localhost bind |
| `MAX_CONCURRENT_SCRAPES` | `2` | Simultaneous browser contexts |
| `QUEUE_LIMIT` | `20` | Pending jobs before `429` |
| `JOB_RESULT_TTL_SECONDS` | `900` | Result retention after completion |
| `SYNC_SCRAPE_TIMEOUT_SECONDS` | `240` | Hard cap on `POST /scrape` |
| `OTP_WAIT_TIMEOUT_SECONDS` | `300` | `waiting_for_otp` cap |
| `CHROMIUM_PATH` | `/usr/bin/chromium` | Puppeteer executable |
| `CHROMIUM_ARGS` | — | Extra Chromium launch args (comma/space separated) |
| `FAILURE_SCREENSHOTS_DIR` | — | Enable failure screenshots when set |
| `LOG_LEVEL` | `info` | `fatal`/`error`/`warn`/`info`/`debug`/`trace`/`silent` |
| `RATE_LIMIT_MAX` | `10` | Job/scrape creations per window |
| `RATE_LIMIT_WINDOW_SECONDS` | `900` | Rate-limit window (15 min) |

**Binding safety.** If `API_TOKENS` is empty, Scipio refuses to expose an
unauthenticated API on a public interface: it clamps `BIND` to `127.0.0.1` and
logs a loud warning. Set `ALLOW_INSECURE=true` to keep a public bind without
tokens (not recommended).

---

## Authentication

When `API_TOKENS` is set, every `/api/v1/*` route requires a token via either:

- `Authorization: Bearer <token>`, or
- `X-API-Token: <token>`

Public routes (no auth): `/healthz`, `/readyz`, `/version`, `/metrics`, `/docs`,
`/openapi.json`.

If no tokens are configured, `/api/v1` is open (bootstrap mode) — intended only
for first-run/localhost use.

---

## API

Base path `/api/v1`. Interactive docs at `/docs`, spec at `/openapi.json`.

| Method & path | Purpose |
|---|---|
| `GET /api/v1/companies` | Companies, login fields, 2FA, opt-in features |
| `POST /api/v1/scrape` | Synchronous scrape (blocks; not for interactive 2FA) |
| `POST /api/v1/jobs` | Create async job → `202 { jobId, status }` |
| `GET /api/v1/jobs/{id}` | Job status + progress events + queue position |
| `GET /api/v1/jobs/{id}/result` | Full result once terminal (`409` while pending) |
| `POST /api/v1/jobs/{id}/otp` | Submit OTP for a `waiting_for_otp` job |
| `DELETE /api/v1/jobs/{id}` | Cancel/delete a job |
| `POST /api/v1/2fa/trigger` | OneZero: send an OTP to a phone number |
| `POST /api/v1/2fa/long-term-token` | OneZero: OTP → long-term token |
| `GET /healthz` `GET /readyz` `GET /version` | Health/readiness/version |
| `GET /metrics` | Prometheus metrics |

Credentials are a **discriminated union keyed by `companyId`** — Swagger shows
exactly which fields each company needs, and mismatched shapes are rejected.

### Example: synchronous scrape (Mizrahi)

For Mizrahi, `username` is your **ID number**.

```bash
curl -sS -X POST http://localhost:8080/api/v1/scrape \
  -H "Authorization: Bearer change-me-please" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "companyId": "mizrahi", "username": "012345678", "password": "secret" },
    "options": { "startDate": "2024-01-01", "combineInstallments": false }
  }'
```

### Example: async job

```bash
# 1) create
JOB=$(curl -sS -X POST http://localhost:8080/api/v1/jobs \
  -H "Authorization: Bearer change-me-please" -H "Content-Type: application/json" \
  -d '{"credentials":{"companyId":"isracard","id":"012345678","card6Digits":"123456","password":"secret"},
       "options":{"startDate":"2024-01-01"}}' | jq -r .jobId)

# 2) poll
curl -sS http://localhost:8080/api/v1/jobs/$JOB \
  -H "Authorization: Bearer change-me-please"

# 3) fetch result once "succeeded"/"failed"
curl -sS http://localhost:8080/api/v1/jobs/$JOB/result \
  -H "Authorization: Bearer change-me-please"
```

### Example: OneZero 2FA

OneZero requires two-factor auth. Two options:

**A. One-time: obtain a reusable long-term token**, then use it for all scrapes.

```bash
# send an OTP to your phone
curl -sS -X POST http://localhost:8080/api/v1/2fa/trigger \
  -H "Authorization: Bearer change-me-please" -H "Content-Type: application/json" \
  -d '{"companyId":"oneZero","phoneNumber":"972500000000"}'

# exchange the OTP code you received for a long-term token
curl -sS -X POST http://localhost:8080/api/v1/2fa/long-term-token \
  -H "Authorization: Bearer change-me-please" -H "Content-Type: application/json" \
  -d '{"companyId":"oneZero","otpCode":"123456"}'
# -> { "longTermTwoFactorAuthToken": "..." }   (store this client-side)

# scrape using the token (works on /scrape or /jobs)
curl -sS -X POST http://localhost:8080/api/v1/scrape \
  -H "Authorization: Bearer change-me-please" -H "Content-Type: application/json" \
  -d '{"credentials":{"companyId":"oneZero","email":"me@example.com","password":"secret",
       "otpLongTermToken":"..."},"options":{"startDate":"2024-01-01"}}'
```

**B. Interactive OTP via a job.** Create a job with a `phoneNumber`; the job
transitions to `waiting_for_otp`; submit the code to resume it.

```bash
JOB=$(curl -sS -X POST http://localhost:8080/api/v1/jobs \
  -H "Authorization: Bearer change-me-please" -H "Content-Type: application/json" \
  -d '{"credentials":{"companyId":"oneZero","email":"me@example.com","password":"secret",
       "phoneNumber":"972500000000"},"options":{"startDate":"2024-01-01"}}' | jq -r .jobId)

# when GET /jobs/$JOB shows status "waiting_for_otp":
curl -sS -X POST http://localhost:8080/api/v1/jobs/$JOB/otp \
  -H "Authorization: Bearer change-me-please" -H "Content-Type: application/json" \
  -d '{"otpCode":"123456"}'
```

### Result & error model

- **Scrape success** mirrors the library: `accounts[]` (with `txns[]`), optional
  `futureDebits[]`.
- **Scrape outcomes** (bad password, blocked, ...) are **not** HTTP errors —
  they return `success: false` with an `errorType`
  (`INVALID_PASSWORD`, `CHANGE_PASSWORD`, `ACCOUNT_BLOCKED`, `TIMEOUT`,
  `GENERIC`, ...) inside the result.
- **HTTP errors** (validation, auth, not-found, queue-full `429`, sync timeout
  `504`) use one envelope: `{ "error": { "code", "message", "details?" } }`.

Supported companies (login fields shown in Swagger): Bank Hapoalim, Leumi,
Mizrahi, Discount, Mercantile, Otsar Hahayal, Max, Visa Cal, Isracard, Amex,
Union, Beinleumi, Massad, Yahav, Beyahad Bishvilha, OneZero, Behatsdaa, Pagi.
The list is served **at runtime from the library**, so it always matches the
installed version.

---

## Security model

- **Credentials in POST bodies only** — never in query strings, never echoed in
  responses, never stored beyond a job's in-memory lifetime, scrubbed when the
  job completes. Results are evicted after `JOB_RESULT_TTL_SECONDS`.
- **Never logged.** Request-body logging is disabled and pino redaction censors
  credential fields and auth headers (there is a canary test enforcing this).
- **Auth** via constant-time bearer-token comparison. Without tokens, Scipio
  binds to loopback only.
- **Rate limiting** on scrape/job creation (banks lock accounts after repeated
  failures).
- `/metrics` labels are limited to `companyId` and status — never account
  numbers or credentials.
- Failure screenshots are opt-in (`FAILURE_SCREENSHOTS_DIR`), written to a
  volume, and referenced by job id (path only, never inlined).

---

## Observability

Prometheus metrics at `/metrics`:

- `scipio_scrapes_total{company,status}` — scrapes by company and outcome
- `scipio_scrape_duration_seconds{company,status}` — durations
- `scipio_queue_depth` — pending queued jobs
- `scipio_http_requests_total{method,route,status}` — HTTP requests
- plus default Node/process metrics (`scipio_*`)

Point Prometheus at `/metrics` and build Grafana panels per company/status.

---

## Troubleshooting

- **`CHANGE_PASSWORD`** — the bank requires a password change; log in on the
  bank's site and change it, then retry.
- **`ACCOUNT_BLOCKED`** — too many failed logins. Unblock with the bank; avoid
  aggressive scheduling.
- **Chromium won't launch / arm64** — the image uses **system Chromium** (not
  puppeteer's download). If launch fails in your environment, set
  `CHROMIUM_ARGS=--no-sandbox`. Ensure `--shm-size=1g`.
- **`unable to open ... /dev/shm`** — increase `shm_size` (compose) or
  `--shm-size` (docker run).
- **Scrape failures after a bank site change** — bump the scraper library first
  (`israeli-bank-scrapers-core`); upstream fixes bank breakages quickly.

---

## Development

```bash
npm ci
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest (scraper layer mocked; no live bank calls)
npm run build        # tsc -> dist/
```

Real-credential local smoke test (never in CI):

```bash
SCIPIO_CREDENTIALS='{"companyId":"leumi","username":"...","password":"..."}' \
SCIPIO_START_DATE=2024-01-01 \
npm run scrape:manual
```

### Releasing

Versioning is date-based `YYYY.M.PATCH`. Push a tag `vYYYY.M.PATCH` to trigger
the release workflow, which builds and pushes the multi-arch image
(`techblog/scipio:{version,latest}`) and creates a GitHub release. Use
`scripts/next-version.sh` to compute the next version.

---

## License

[Apache-2.0](./LICENSE).
