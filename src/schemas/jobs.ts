import { Type, type Static } from '@sinclair/typebox';
import { ScrapeResult } from './scrape.js';

/** Progress event types emitted by the library, plus their capture timestamp. */
export const PROGRESS_TYPES = [
  'INITIALIZING',
  'START_SCRAPING',
  'LOGGING_IN',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'CHANGE_PASSWORD',
  'END_SCRAPING',
  'TERMINATING',
] as const;

export const JOB_STATUSES = [
  'queued',
  'running',
  'waiting_for_otp',
  'succeeded',
  'failed',
] as const;

export const ProgressEvent = Type.Object(
  {
    type: Type.Union(PROGRESS_TYPES.map((t) => Type.Literal(t))),
    at: Type.String({ description: 'ISO timestamp when the event was captured.' }),
  },
  { additionalProperties: false, title: 'ProgressEvent' },
);
export type ProgressEvent = Static<typeof ProgressEvent>;

/** Job status view (no financial data — the result is fetched separately). */
export const Job = Type.Object(
  {
    jobId: Type.String(),
    companyId: Type.String(),
    status: Type.Union(JOB_STATUSES.map((s) => Type.Literal(s))),
    createdAt: Type.String(),
    updatedAt: Type.String(),
    queuePosition: Type.Optional(
      Type.Integer({ minimum: 0, description: 'Position in the queue while queued (0 = next).' }),
    ),
    progress: Type.Array(ProgressEvent),
    error: Type.Optional(
      Type.Object(
        { code: Type.String(), message: Type.String() },
        { additionalProperties: false, description: 'Job-level failure (e.g. TIMEOUT).' },
      ),
    ),
  },
  { $id: 'Job', title: 'Job', additionalProperties: false },
);
export type Job = Static<typeof Job>;

export const JobCreatedResponse = Type.Object(
  {
    jobId: Type.String(),
    status: Type.Union(JOB_STATUSES.map((s) => Type.Literal(s))),
  },
  { $id: 'JobCreatedResponse', title: 'JobCreatedResponse', additionalProperties: false },
);
export type JobCreatedResponse = Static<typeof JobCreatedResponse>;

/** Job result once the job is terminal. Mirrors the scrape result model. */
export const JobResultResponse = ScrapeResult;
export type JobResultResponse = Static<typeof JobResultResponse>;

export const OtpSubmission = Type.Object(
  { otpCode: Type.String({ minLength: 1, description: 'The OTP code received by the user.' }) },
  { $id: 'OtpSubmission', title: 'OtpSubmission', additionalProperties: false },
);
export type OtpSubmission = Static<typeof OtpSubmission>;
