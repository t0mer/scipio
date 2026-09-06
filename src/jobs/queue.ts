import type { ScrapeRequest, ScrapeResult } from '../schemas/index.js';
import type { Job } from '../schemas/jobs.js';
import type { ScrapeRunnerLike } from '../scraper/runner.js';
import { OtpBridge } from '../scraper/otp.js';
import type { JobRecord, JobStore } from './store.js';

export class QueueFullError extends Error {
  constructor() {
    super('Job queue is full; try again later.');
    this.name = 'QueueFullError';
  }
}
export class JobNotFoundError extends Error {
  constructor() {
    super('Job not found.');
    this.name = 'JobNotFoundError';
  }
}
export class JobResultNotReadyError extends Error {
  constructor() {
    super('Job result is not ready yet.');
    this.name = 'JobResultNotReadyError';
  }
}
export class JobNotWaitingForOtpError extends Error {
  constructor() {
    super('Job is not waiting for an OTP code.');
    this.name = 'JobNotWaitingForOtpError';
  }
}

export interface JobManagerOptions {
  maxConcurrent: number;
  queueLimit: number;
  otpWaitTimeoutMs: number;
  screenshotsEnabled: boolean;
  /** Called when a job reaches a terminal state, for metrics. */
  onOutcome?: (companyId: string, status: 'succeeded' | 'failed', durationSeconds: number) => void;
}

/**
 * Owns the FIFO queue and bounded-concurrency execution of scrape jobs. Jobs
 * beyond {@link JobManagerOptions.queueLimit} pending are rejected with
 * {@link QueueFullError} (→ HTTP 429). Execution is delegated to a ScrapeRunner;
 * progress, OTP transitions, and results are recorded in the JobStore.
 */
export class JobManager {
  private readonly queue: string[] = [];
  private running = 0;

  constructor(
    private readonly runner: ScrapeRunnerLike,
    private readonly store: JobStore,
    private readonly options: JobManagerOptions,
  ) {}

  /** Enqueues a new job, or throws QueueFullError if the queue is full. */
  create(request: ScrapeRequest): JobRecord {
    if (this.store.countByStatus('queued') >= this.options.queueLimit) {
      throw new QueueFullError();
    }
    const companyId = (request.credentials as { companyId: string }).companyId;
    const record = this.store.create(companyId, request);
    this.queue.push(record.jobId);
    this.schedule();
    return record;
  }

  /** Returns the API view of a job, or throws JobNotFoundError. */
  getView(jobId: string): Job {
    const record = this.store.get(jobId);
    if (!record) throw new JobNotFoundError();
    return this.toView(record);
  }

  /** Returns a terminal job's result, or throws if missing/not ready. */
  getResult(jobId: string): ScrapeResult {
    const record = this.store.get(jobId);
    if (!record) throw new JobNotFoundError();
    if (record.status !== 'succeeded' && record.status !== 'failed') {
      throw new JobResultNotReadyError();
    }
    return record.result ?? { success: false, errorType: 'GENERIC', errorMessage: 'No result.' };
  }

  /** Submits an OTP code for a job that is waiting for one. */
  submitOtp(jobId: string, otpCode: string): void {
    const record = this.store.get(jobId);
    if (!record) throw new JobNotFoundError();
    if (record.status !== 'waiting_for_otp' || !record.otpBridge) {
      throw new JobNotWaitingForOtpError();
    }
    record.otpBridge.submit(otpCode);
    this.store.patch(jobId, { status: 'running' });
  }

  /** Number of jobs currently queued (pending). */
  pendingCount(): number {
    return this.store.countByStatus('queued');
  }

  /** Cancels/deletes a job (best effort for in-flight scrapes). */
  cancel(jobId: string): void {
    const record = this.store.get(jobId);
    if (!record) throw new JobNotFoundError();
    const queueIndex = this.queue.indexOf(jobId);
    if (queueIndex !== -1) this.queue.splice(queueIndex, 1);
    record.cancelled = true;
    if (record.otpBridge && record.otpBridge.isWaiting) record.otpBridge.cancel();
    this.store.remove(jobId);
  }

  private schedule(): void {
    while (this.running < this.options.maxConcurrent && this.queue.length > 0) {
      const jobId = this.queue.shift()!;
      const record = this.store.get(jobId);
      if (!record || record.cancelled) continue;
      this.running++;
      void this.run(jobId).finally(() => {
        this.running--;
        this.schedule();
      });
    }
  }

  private async run(jobId: string): Promise<void> {
    const record = this.store.get(jobId);
    if (!record || !record.request || record.cancelled) return;
    const request = record.request;
    const companyId = record.companyId;
    const startedAt = Date.now();
    const emit = (status: 'succeeded' | 'failed'): void =>
      this.options.onOutcome?.(companyId, status, (Date.now() - startedAt) / 1000);

    const otpBridge = new OtpBridge({
      timeoutMs: this.options.otpWaitTimeoutMs,
      onWaiting: () => this.store.patch(jobId, { status: 'waiting_for_otp' }),
    });
    this.store.patch(jobId, { status: 'running', otpBridge });

    try {
      const result = await this.runner.run(request, {
        onProgress: (event) => this.store.appendProgress(jobId, event),
        otpBridge,
        screenshotId: this.options.screenshotsEnabled ? jobId : undefined,
      });

      const current = this.store.get(jobId);
      if (!current || current.cancelled) return;

      // Bank-level failures (INVALID_PASSWORD, ...) are scrape outcomes → the job
      // succeeded and carries success:false. A TIMEOUT (OTP or navigation) is a
      // genuine job failure.
      const failed = result.success === false && result.errorType === 'TIMEOUT';
      const status = failed ? 'failed' : 'succeeded';
      this.store.patch(jobId, {
        status,
        result,
        error: failed
          ? { code: result.errorType ?? 'TIMEOUT', message: result.errorMessage ?? 'Timed out.' }
          : undefined,
      });
      emit(status);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (this.store.get(jobId)?.cancelled) return;
      this.store.patch(jobId, {
        status: 'failed',
        result: { success: false, errorType: 'GENERIC', errorMessage: message },
        error: { code: 'GENERIC', message },
      });
      emit('failed');
    }
  }

  private toView(record: JobRecord): Job {
    const view: Job = {
      jobId: record.jobId,
      companyId: record.companyId,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      progress: record.progress,
    };
    if (record.status === 'queued') {
      const pos = this.queue.indexOf(record.jobId);
      if (pos !== -1) view.queuePosition = pos;
    }
    if (record.error) view.error = record.error;
    return view;
  }
}
