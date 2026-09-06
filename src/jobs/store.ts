import { randomUUID } from 'node:crypto';
import type { Job, ProgressEvent } from '../schemas/jobs.js';
import type { ScrapeRequest, ScrapeResult } from '../schemas/index.js';
import type { OtpBridge } from '../scraper/otp.js';

export type JobStatus = Job['status'];

/**
 * In-memory job record. Fields below `--- runtime only ---` hold sensitive or
 * non-serialisable state (credentials, the OTP bridge) and are never exposed in
 * the API view; they are scrubbed when the job completes.
 */
export interface JobRecord {
  jobId: string;
  companyId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  progress: ProgressEvent[];
  result?: ScrapeResult;
  error?: { code: string; message: string };
  // --- runtime only, never serialised ---
  request?: ScrapeRequest;
  otpBridge?: OtpBridge;
  cancelled?: boolean;
}

const TERMINAL: ReadonlySet<JobStatus> = new Set<JobStatus>(['succeeded', 'failed']);

/**
 * Holds job records in memory and evicts terminal jobs after a TTL — results
 * contain financial data, so they are not kept longer than necessary. Concurrency
 * and execution live in the JobManager; this class is only storage + lifecycle.
 */
export class JobStore {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly ttlMs: number) {}

  create(companyId: string, request: ScrapeRequest): JobRecord {
    const now = new Date().toISOString();
    const record: JobRecord = {
      jobId: randomUUID(),
      companyId,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      progress: [],
      request,
    };
    this.jobs.set(record.jobId, record);
    return record;
  }

  get(jobId: string): JobRecord | undefined {
    return this.jobs.get(jobId);
  }

  list(): JobRecord[] {
    return [...this.jobs.values()];
  }

  /** Applies a patch, refreshes updatedAt, and schedules eviction on terminal. */
  patch(jobId: string, patch: Partial<JobRecord>): JobRecord | undefined {
    const record = this.jobs.get(jobId);
    if (!record) return undefined;
    Object.assign(record, patch);
    record.updatedAt = new Date().toISOString();
    if (TERMINAL.has(record.status)) {
      this.scrubSensitive(record);
      this.scheduleEviction(jobId);
    }
    return record;
  }

  appendProgress(jobId: string, event: ProgressEvent): void {
    const record = this.jobs.get(jobId);
    if (!record) return;
    record.progress.push(event);
    record.updatedAt = new Date().toISOString();
  }

  remove(jobId: string): boolean {
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
    const record = this.jobs.get(jobId);
    if (record) this.scrubSensitive(record);
    return this.jobs.delete(jobId);
  }

  size(): number {
    return this.jobs.size;
  }

  countByStatus(status: JobStatus): number {
    let n = 0;
    for (const record of this.jobs.values()) if (record.status === status) n++;
    return n;
  }

  /** Best-effort removal of credentials and runtime handles from a record. */
  private scrubSensitive(record: JobRecord): void {
    record.request = undefined;
    record.otpBridge = undefined;
  }

  private scheduleEviction(jobId: string): void {
    const existing = this.timers.get(jobId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => this.remove(jobId), this.ttlMs);
    if (typeof timer.unref === 'function') timer.unref();
    this.timers.set(jobId, timer);
  }
}
