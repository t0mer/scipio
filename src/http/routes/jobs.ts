import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ScrapeRequest, ScrapeResult } from '../../schemas/scrape.js';
import { Job, JobCreatedResponse, OtpSubmission } from '../../schemas/jobs.js';
import { ErrorEnvelope, errorEnvelope } from '../../schemas/common.js';

const JobParams = Type.Object({ jobId: Type.String() });

/** Async scrape jobs: create, poll, fetch result, submit OTP, cancel. */
export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    '/jobs',
    {
      config: {
        rateLimit: {
          max: app.config.rateLimit.max,
          timeWindow: app.config.rateLimit.timeWindowSeconds * 1000,
        },
      },
      schema: {
        tags: ['jobs'],
        summary: 'Create an async scrape job',
        body: ScrapeRequest,
        response: { 202: JobCreatedResponse, 422: ErrorEnvelope, 429: ErrorEnvelope },
      },
    },
    async (req, reply) => {
      const creds = req.body.credentials as {
        companyId: string;
        otpLongTermToken?: string;
        phoneNumber?: string;
      };
      // OneZero must have either a long-term token or a phone number for the
      // interactive OTP flow — reject early rather than creating a doomed job.
      if (creds.companyId === 'oneZero' && !creds.otpLongTermToken && !creds.phoneNumber) {
        return reply
          .code(422)
          .send(
            errorEnvelope(
              'TWO_FACTOR_REQUIRED',
              'oneZero requires otpLongTermToken or phoneNumber (for interactive OTP).',
            ),
          );
      }
      const record = app.services.jobs.create(req.body);
      return reply.code(202).send({ jobId: record.jobId, status: record.status });
    },
  );

  typed.get(
    '/jobs/:jobId',
    {
      schema: {
        tags: ['jobs'],
        summary: 'Get job status and progress',
        params: JobParams,
        response: { 200: Job, 404: ErrorEnvelope },
      },
    },
    async (req) => app.services.jobs.getView(req.params.jobId),
  );

  typed.get(
    '/jobs/:jobId/result',
    {
      schema: {
        tags: ['jobs'],
        summary: 'Get the scrape result for a completed job',
        params: JobParams,
        response: { 200: ScrapeResult, 404: ErrorEnvelope, 409: ErrorEnvelope },
      },
    },
    async (req) => app.services.jobs.getResult(req.params.jobId),
  );

  typed.post(
    '/jobs/:jobId/otp',
    {
      schema: {
        tags: ['jobs'],
        summary: 'Submit an OTP code for a job awaiting one',
        params: JobParams,
        body: OtpSubmission,
        response: { 204: Type.Null(), 404: ErrorEnvelope, 409: ErrorEnvelope },
      },
    },
    async (req, reply) => {
      app.services.jobs.submitOtp(req.params.jobId, req.body.otpCode);
      return reply.code(204).send(null);
    },
  );

  typed.delete(
    '/jobs/:jobId',
    {
      schema: {
        tags: ['jobs'],
        summary: 'Cancel or delete a job',
        params: JobParams,
        response: { 204: Type.Null(), 404: ErrorEnvelope },
      },
    },
    async (req, reply) => {
      app.services.jobs.cancel(req.params.jobId);
      return reply.code(204).send(null);
    },
  );
}
