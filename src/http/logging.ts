import type { PinoLoggerOptions } from 'fastify/types/logger.js';

/**
 * pino redaction paths — defence-in-depth. Fastify never logs request bodies
 * (only the request line), so credentials do not reach the logger through normal
 * paths; these censor sensitive keys and headers if anything is logged directly.
 */
export const redactionPaths = [
  'req.headers.authorization',
  'req.headers["x-api-token"]',
  'req.body',
  'credentials',
  'password',
  '*.password',
  'otpCode',
  'otpLongTermToken',
  'card6Digits',
  'nationalID',
  'userCode',
  'username',
  'email',
  'phoneNumber',
];

/** Fastify/pino logger options with redaction applied. */
export function loggerOptions(level: string): PinoLoggerOptions {
  return {
    level,
    redact: { paths: redactionPaths, censor: '[REDACTED]' },
  };
}
