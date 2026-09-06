import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { loggerOptions } from '../src/http/logging.js';

/**
 * Canary test: even if a credentials-bearing object is logged directly, the
 * configured redaction must prevent the secret values from reaching the output.
 */
describe('log redaction canary', () => {
  it('never emits credential values to the logs', () => {
    const chunks: string[] = [];
    const stream = { write: (s: string) => chunks.push(s) };
    const logger = pino(loggerOptions('info'), stream);

    logger.info(
      {
        credentials: {
          companyId: 'isracard',
          id: '000000000',
          card6Digits: '123456',
          password: 'CANARY_PASSWORD',
        },
        otpCode: 'CANARY_OTP',
        otpLongTermToken: 'CANARY_TOKEN',
        req: { headers: { authorization: 'Bearer CANARY_BEARER' } },
      },
      'handled request',
    );

    const out = chunks.join('');
    expect(out).not.toContain('CANARY_PASSWORD');
    expect(out).not.toContain('CANARY_OTP');
    expect(out).not.toContain('CANARY_TOKEN');
    expect(out).not.toContain('CANARY_BEARER');
    expect(out).toContain('[REDACTED]');
  });
});
