import { describe, it, expect } from 'vitest';
import {
  JobManager,
  QueueFullError,
  JobNotFoundError,
  JobResultNotReadyError,
  JobNotWaitingForOtpError,
} from '../src/jobs/queue.js';
import { JobStore } from '../src/jobs/store.js';
import type { ScrapeRunnerLike, RunContext } from '../src/scraper/runner.js';
import type { ScrapeRequest, ScrapeResult } from '../src/schemas/index.js';

const flush = () => new Promise((r) => setImmediate(r));

function req(companyId = 'leumi'): ScrapeRequest {
  return {
    credentials: { companyId, username: 'u', password: 'p' } as ScrapeRequest['credentials'],
    options: { startDate: '2024-01-01' },
  };
}

/** A runner whose each call is resolved manually, to control timing. */
function gatedRunner() {
  const calls: Array<{ resolve: (r: ScrapeResult) => void; ctx?: RunContext }> = [];
  const runner: ScrapeRunnerLike = {
    run: (_request, ctx) =>
      new Promise<ScrapeResult>((resolve) => {
        calls.push({ resolve, ctx });
      }),
  };
  return { runner, calls };
}

const opts = {
  maxConcurrent: 2,
  queueLimit: 20,
  otpWaitTimeoutMs: 60_000,
  screenshotsEnabled: false,
};

describe('JobManager concurrency & queueing', () => {
  it('runs up to maxConcurrent and queues the rest FIFO', async () => {
    const { runner, calls } = gatedRunner();
    const mgr = new JobManager(runner, new JobStore(60_000), opts);

    const j1 = mgr.create(req());
    const j2 = mgr.create(req());
    const j3 = mgr.create(req());

    expect(calls).toHaveLength(2);
    expect(mgr.getView(j1.jobId).status).toBe('running');
    expect(mgr.getView(j2.jobId).status).toBe('running');
    expect(mgr.getView(j3.jobId).status).toBe('queued');
    expect(mgr.getView(j3.jobId).queuePosition).toBe(0);

    calls[0]!.resolve({ success: true, accounts: [] });
    await flush();

    expect(mgr.getView(j1.jobId).status).toBe('succeeded');
    expect(calls).toHaveLength(3); // j3 started
    expect(mgr.getView(j3.jobId).status).toBe('running');
  });

  it('rejects new jobs when the queue is full', async () => {
    const { runner } = gatedRunner();
    const mgr = new JobManager(runner, new JobStore(60_000), {
      ...opts,
      maxConcurrent: 1,
      queueLimit: 1,
    });
    mgr.create(req()); // running
    mgr.create(req()); // queued (1 == limit)
    expect(() => mgr.create(req())).toThrow(QueueFullError);
  });
});

describe('JobManager results & outcomes', () => {
  it('409s on result before the job is terminal, then returns it', async () => {
    const { runner, calls } = gatedRunner();
    const mgr = new JobManager(runner, new JobStore(60_000), opts);
    const j = mgr.create(req());
    expect(() => mgr.getResult(j.jobId)).toThrow(JobResultNotReadyError);
    calls[0]!.resolve({ success: true, accounts: [{ accountNumber: '1', txns: [] }] });
    await flush();
    expect(mgr.getResult(j.jobId).success).toBe(true);
  });

  it('marks a bank-level failure as a succeeded job carrying success:false', async () => {
    const { runner, calls } = gatedRunner();
    const mgr = new JobManager(runner, new JobStore(60_000), opts);
    const j = mgr.create(req());
    calls[0]!.resolve({ success: false, errorType: 'INVALID_PASSWORD', errorMessage: 'bad' });
    await flush();
    expect(mgr.getView(j.jobId).status).toBe('succeeded');
    expect(mgr.getResult(j.jobId)).toMatchObject({ success: false, errorType: 'INVALID_PASSWORD' });
  });

  it('marks a TIMEOUT as a failed job with an error', async () => {
    const { runner, calls } = gatedRunner();
    const mgr = new JobManager(runner, new JobStore(60_000), opts);
    const j = mgr.create(req());
    calls[0]!.resolve({ success: false, errorType: 'TIMEOUT', errorMessage: 'timed out' });
    await flush();
    const view = mgr.getView(j.jobId);
    expect(view.status).toBe('failed');
    expect(view.error?.code).toBe('TIMEOUT');
  });

  it('throws JobNotFoundError for unknown jobs', () => {
    const { runner } = gatedRunner();
    const mgr = new JobManager(runner, new JobStore(60_000), opts);
    expect(() => mgr.getView('nope')).toThrow(JobNotFoundError);
  });
});

describe('JobManager OTP flow', () => {
  it('transitions to waiting_for_otp and resumes when a code is submitted', async () => {
    // Runner that waits for the OTP via the bridge before resolving.
    const runner: ScrapeRunnerLike = {
      run: async (_request, ctx) => {
        const code = await ctx!.otpBridge!.retriever();
        return { success: true, accounts: [{ accountNumber: code, txns: [] }] };
      },
    };
    const mgr = new JobManager(runner, new JobStore(60_000), opts);
    const j = mgr.create(req('oneZero'));
    await flush();
    expect(mgr.getView(j.jobId).status).toBe('waiting_for_otp');

    mgr.submitOtp(j.jobId, '424242');
    await flush();
    expect(mgr.getView(j.jobId).status).toBe('succeeded');
    expect(mgr.getResult(j.jobId).accounts?.[0]?.accountNumber).toBe('424242');
  });

  it('rejects an OTP submission when the job is not waiting', async () => {
    const { runner } = gatedRunner();
    const mgr = new JobManager(runner, new JobStore(60_000), opts);
    const j = mgr.create(req());
    expect(() => mgr.submitOtp(j.jobId, '1')).toThrow(JobNotWaitingForOtpError);
  });
});

describe('JobManager cancellation', () => {
  it('cancels a queued job and removes it', async () => {
    const { runner } = gatedRunner();
    const mgr = new JobManager(runner, new JobStore(60_000), { ...opts, maxConcurrent: 1 });
    mgr.create(req()); // running
    const queued = mgr.create(req()); // queued
    mgr.cancel(queued.jobId);
    expect(() => mgr.getView(queued.jobId)).toThrow(JobNotFoundError);
  });
});
