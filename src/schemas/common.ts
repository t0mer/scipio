import { Type, type Static } from '@sinclair/typebox';

/**
 * Single error envelope used for every HTTP-level error (validation, auth,
 * not-found, queue-full, server timeout). Scrape *outcomes* (invalid password,
 * account blocked, ...) are not HTTP errors — see the scrape result model.
 */
export const ErrorEnvelope = Type.Object(
  {
    error: Type.Object({
      code: Type.String({ description: 'Machine-readable error code.' }),
      message: Type.String({ description: 'Human-readable error message.' }),
      details: Type.Optional(Type.Unknown()),
    }),
  },
  { title: 'ErrorEnvelope' },
);
export type ErrorEnvelope = Static<typeof ErrorEnvelope>;

/** Helper to build a consistent error-envelope object. */
export function errorEnvelope(code: string, message: string, details?: unknown): ErrorEnvelope {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}
