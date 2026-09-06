import type { FastifyError, FastifyInstance } from 'fastify';
import { errorEnvelope } from '../schemas/common.js';
import {
  QueueFullError,
  JobNotFoundError,
  JobResultNotReadyError,
  JobNotWaitingForOtpError,
} from '../jobs/queue.js';
import { ScrapeInputError } from '../scraper/runner.js';
import { TwoFactorSessionError } from '../scraper/twofa.js';

interface Mapped {
  status: number;
  code: string;
}

/** Maps a known error to an HTTP status + machine code; undefined = 500. */
function mapError(err: unknown): Mapped | undefined {
  if (err instanceof QueueFullError) return { status: 429, code: 'QUEUE_FULL' };
  if (err instanceof JobNotFoundError) return { status: 404, code: 'NOT_FOUND' };
  if (err instanceof JobResultNotReadyError) return { status: 409, code: 'NOT_READY' };
  if (err instanceof JobNotWaitingForOtpError) return { status: 409, code: 'NOT_WAITING_FOR_OTP' };
  if (err instanceof ScrapeInputError) return { status: 422, code: 'UNPROCESSABLE' };
  if (err instanceof TwoFactorSessionError) return { status: 409, code: 'NO_2FA_SESSION' };
  return undefined;
}

/**
 * Installs a single error/not-found path that always returns the standard error
 * envelope. Validation failures become 400s with details; known domain errors
 * map to their status; everything else is a logged 500 that never leaks internals.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send(errorEnvelope('NOT_FOUND', `Route ${req.method} ${req.url} not found.`));
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    // Schema validation errors (Fastify attaches `validation`).
    if (err.validation) {
      reply.code(400).send(errorEnvelope('VALIDATION', err.message, err.validation));
      return;
    }

    const mapped = mapError(err);
    if (mapped) {
      reply.code(mapped.status).send(errorEnvelope(mapped.code, err.message));
      return;
    }

    // Rate-limit errors from @fastify/rate-limit carry statusCode 429.
    if (typeof err.statusCode === 'number' && err.statusCode === 429) {
      reply.code(429).send(errorEnvelope('RATE_LIMITED', err.message));
      return;
    }

    req.log.error({ err }, 'unhandled error');
    reply.code(500).send(errorEnvelope('INTERNAL', 'Internal server error.'));
  });
}
