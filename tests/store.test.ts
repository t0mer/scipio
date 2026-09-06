import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobStore } from '../src/jobs/store.js';
import type { ScrapeRequest } from '../src/schemas/index.js';

const request: ScrapeRequest = {
  credentials: { companyId: 'leumi', username: 'u', password: 'p' },
  options: { startDate: '2024-01-01' },
};

describe('JobStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('creates a queued job with an id and timestamps', () => {
    const store = new JobStore(1000);
    const rec = store.create('leumi', request);
    expect(rec.jobId).toBeTruthy();
    expect(rec.status).toBe('queued');
    expect(rec.companyId).toBe('leumi');
    expect(rec.createdAt).toBeTruthy();
    expect(store.get(rec.jobId)).toBe(rec);
    expect(store.list()).toHaveLength(1);
  });

  it('counts jobs by status', () => {
    const store = new JobStore(1000);
    store.create('leumi', request);
    const b = store.create('max', request);
    store.patch(b.jobId, { status: 'running' });
    expect(store.countByStatus('queued')).toBe(1);
    expect(store.countByStatus('running')).toBe(1);
  });

  it('appends progress events', () => {
    const store = new JobStore(1000);
    const rec = store.create('leumi', request);
    store.appendProgress(rec.jobId, { type: 'LOGGING_IN', at: '2024-01-01T00:00:00Z' });
    expect(store.get(rec.jobId)!.progress).toHaveLength(1);
  });

  it('scrubs sensitive data and evicts terminal jobs after the TTL', () => {
    const store = new JobStore(1000);
    const rec = store.create('leumi', request);
    store.patch(rec.jobId, { status: 'succeeded', result: { success: true } });
    // credentials scrubbed immediately on terminal
    expect(store.get(rec.jobId)!.request).toBeUndefined();
    // still present before TTL
    vi.advanceTimersByTime(999);
    expect(store.get(rec.jobId)).toBeDefined();
    // evicted after TTL
    vi.advanceTimersByTime(2);
    expect(store.get(rec.jobId)).toBeUndefined();
  });

  it('removes a job explicitly', () => {
    const store = new JobStore(1000);
    const rec = store.create('leumi', request);
    expect(store.remove(rec.jobId)).toBe(true);
    expect(store.get(rec.jobId)).toBeUndefined();
  });
});
