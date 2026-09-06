import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createMetrics } from '../src/metrics.js';
import { JobStore } from '../src/jobs/store.js';
import { JobManager } from '../src/jobs/queue.js';
import type { ScrapeRunnerLike } from '../src/scraper/runner.js';
import type { Services } from '../src/services.js';
import type { BrowserManager } from '../src/scraper/browser.js';
import type { TwoFactorManager } from '../src/scraper/twofa.js';
import type { ScrapeResult } from '../src/schemas/index.js';

const TOKEN = 'test-token';
const auth = { authorization: `Bearer ${TOKEN}` };
const flush = () => new Promise((r) => setImmediate(r));

function fakeServices(run?: ScrapeRunnerLike['run']): Services {
  const metrics = createMetrics();
  const runner: ScrapeRunnerLike = {
    run: run ?? (async (): Promise<ScrapeResult> => ({ success: true, accounts: [] })),
  };
  const jobs = new JobManager(runner, new JobStore(60_000), {
    maxConcurrent: 2,
    queueLimit: 20,
    otpWaitTimeoutMs: 60_000,
    screenshotsEnabled: false,
  });
  const browser = { probe: async () => true } as unknown as BrowserManager;
  const twoFactor = {
    trigger: async () => ({ success: true }),
    getLongTermToken: async () => ({ success: true, longTermTwoFactorAuthToken: 'LTT' }),
    closeAll: async () => undefined,
  } as unknown as TwoFactorManager;
  return { browser, runner, jobs, twoFactor, metrics, close: async () => undefined };
}

async function makeApp(run?: ScrapeRunnerLike['run']): Promise<FastifyInstance> {
  const config = loadConfig({ API_TOKENS: TOKEN, BIND: '127.0.0.1', LOG_LEVEL: 'silent' });
  return buildApp(config, { services: fakeServices(run) });
}

describe('system & docs endpoints (public)', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await makeApp();
  });
  afterEach(async () => app.close());

  it('GET /healthz returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('GET /readyz reflects Chromium availability', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', chromium: true });
  });

  it('GET /version returns versions', async () => {
    const res = await app.inject({ method: 'GET', url: '/version' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('libraryVersion');
  });

  it('serves an OpenAPI 3.1 document', async () => {
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths).toHaveProperty('/api/v1/scrape');
  });

  it('exposes Prometheus metrics without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('scipio_');
  });
});

describe('authentication', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await makeApp();
  });
  afterEach(async () => app.close());

  it('rejects protected routes without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/companies' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('accepts a valid bearer token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/companies', headers: auth });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.companies.some((c: { companyId: string }) => c.companyId === 'leumi')).toBe(true);
    expect(
      body.companies.find((c: { companyId: string }) => c.companyId === 'oneZero')
        .requiresTwoFactor,
    ).toBe(true);
  });

  it('accepts the X-API-Token header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/companies',
      headers: { 'x-api-token': TOKEN },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('scrape endpoint', () => {
  let app: FastifyInstance;
  afterEach(async () => app.close());

  it('validates the request body', async () => {
    app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/scrape',
      headers: auth,
      payload: { credentials: { companyId: 'leumi' }, options: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
  });

  it('runs a synchronous scrape', async () => {
    app = await makeApp(async () => ({
      success: true,
      accounts: [{ accountNumber: '1', txns: [] }],
    }));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/scrape',
      headers: auth,
      payload: {
        credentials: { companyId: 'leumi', username: 'u', password: 'p' },
        options: { startDate: '2024-01-01' },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
  });

  it('rejects a 2FA company on the sync endpoint', async () => {
    app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/scrape',
      headers: auth,
      payload: {
        credentials: { companyId: 'oneZero', email: 'a@b.co', password: 'p' },
        options: { startDate: '2024-01-01' },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('TWO_FACTOR_REQUIRED');
  });
});

describe('jobs flow', () => {
  let app: FastifyInstance;
  afterEach(async () => app.close());

  it('creates, runs, and returns a job result', async () => {
    app = await makeApp(async () => ({
      success: true,
      accounts: [{ accountNumber: 'X', txns: [] }],
    }));
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      headers: auth,
      payload: {
        credentials: { companyId: 'leumi', username: 'u', password: 'p' },
        options: { startDate: '2024-01-01' },
      },
    });
    expect(created.statusCode).toBe(202);
    const { jobId } = created.json();
    expect(jobId).toBeTruthy();

    await flush();
    const status = await app.inject({ method: 'GET', url: `/api/v1/jobs/${jobId}`, headers: auth });
    expect(status.statusCode).toBe(200);
    expect(status.json().status).toBe('succeeded');

    const result = await app.inject({
      method: 'GET',
      url: `/api/v1/jobs/${jobId}/result`,
      headers: auth,
    });
    expect(result.statusCode).toBe(200);
    expect(result.json().accounts[0].accountNumber).toBe('X');
  });

  it('404s an unknown job', async () => {
    app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/jobs/nope', headers: auth });
    expect(res.statusCode).toBe(404);
  });

  it('deletes a job', async () => {
    app = await makeApp(
      () => new Promise(() => {}), // never resolves: job stays running
    );
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      headers: auth,
      payload: {
        credentials: { companyId: 'leumi', username: 'u', password: 'p' },
        options: { startDate: '2024-01-01' },
      },
    });
    const { jobId } = created.json();
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/jobs/${jobId}`, headers: auth });
    expect(del.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: `/api/v1/jobs/${jobId}`, headers: auth });
    expect(after.statusCode).toBe(404);
  });
});

describe('2fa endpoints', () => {
  let app: FastifyInstance;
  afterEach(async () => app.close());

  it('triggers OTP and exchanges it for a long-term token', async () => {
    app = await makeApp();
    const trigger = await app.inject({
      method: 'POST',
      url: '/api/v1/2fa/trigger',
      headers: auth,
      payload: { companyId: 'oneZero', phoneNumber: '972500000000' },
    });
    expect(trigger.statusCode).toBe(200);
    expect(trigger.json()).toEqual({ success: true });

    const token = await app.inject({
      method: 'POST',
      url: '/api/v1/2fa/long-term-token',
      headers: auth,
      payload: { companyId: 'oneZero', otpCode: '123456' },
    });
    expect(token.statusCode).toBe(200);
    expect(token.json().longTermTwoFactorAuthToken).toBe('LTT');
  });
});

describe('not found', () => {
  it('returns the error envelope for unknown routes', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/nope', headers: auth });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    await app.close();
  });
});
