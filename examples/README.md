# Scipio examples

Contract samples for every company and endpoint. All requests assume the API is
reachable at `http://localhost:8080` and, where auth is required, an `$API_TOKEN` from
`API_TOKENS`.

Interactive docs (generated OpenAPI 3.1) are served at `/docs`; the raw spec at
`/openapi.json`.

## Companies (18)

Each file documents the credential contract and a sample scrape.

- [Bank Hapoalim (`hapoalim`)](companies/hapoalim.md)
- [Bank Leumi (`leumi`)](companies/leumi.md)
- [Mizrahi Bank (`mizrahi`)](companies/mizrahi.md)
- [Discount Bank (`discount`)](companies/discount.md)
- [Mercantile Bank (`mercantile`)](companies/mercantile.md)
- [Bank Otsar Hahayal (`otsarHahayal`)](companies/otsarHahayal.md)
- [Max (`max`)](companies/max.md)
- [Visa Cal (`visaCal`)](companies/visaCal.md)
- [Isracard (`isracard`)](companies/isracard.md)
- [Amex (`amex`)](companies/amex.md)
- [Union (`union`)](companies/union.md)
- [Beinleumi (`beinleumi`)](companies/beinleumi.md)
- [Massad (`massad`)](companies/massad.md)
- [Bank Yahav (`yahav`)](companies/yahav.md)
- [Beyahad Bishvilha (`beyahadBishvilha`)](companies/beyahadBishvilha.md)
- [One Zero (`oneZero`)](companies/oneZero.md)
- [Behatsdaa (`behatsdaa`)](companies/behatsdaa.md)
- [Pagi (`pagi`)](companies/pagi.md)

## Endpoints (14)

- [`GET /api/v1/companies`](endpoints/companies.md) — List companies
- [`POST /api/v1/scrape`](endpoints/scrape.md) — Synchronous scrape
- [`POST /api/v1/jobs`](endpoints/jobs-create.md) — Create a scrape job
- [`GET /api/v1/jobs/{jobId}`](endpoints/jobs-get.md) — Get job status
- [`GET /api/v1/jobs/{jobId}/result`](endpoints/jobs-result.md) — Get job result
- [`POST /api/v1/jobs/{jobId}/otp`](endpoints/jobs-otp.md) — Submit OTP for a job
- [`DELETE /api/v1/jobs/{jobId}`](endpoints/jobs-delete.md) — Cancel or delete a job
- [`POST /api/v1/2fa/trigger`](endpoints/2fa-trigger.md) — Trigger OTP (OneZero)
- [`POST /api/v1/2fa/long-term-token`](endpoints/2fa-long-term-token.md) — Exchange OTP for a long-term token (OneZero)
- [`GET /healthz`](endpoints/healthz.md) — Liveness
- [`GET /readyz`](endpoints/readyz.md) — Readiness
- [`GET /version`](endpoints/version.md) — Version
- [`GET /metrics`](endpoints/metrics.md) — Prometheus metrics
- [`GET /openapi.json`](endpoints/openapi.md) — OpenAPI document

## Also on the /docs endpoint

Swagger UI at `GET /docs` renders these same schemas interactively.
