import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

/** Thrown when environment configuration is invalid; message aggregates all issues. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/**
 * ConfigSchema is the single source of truth for the shape and ranges of the
 * runtime configuration. Env strings are parsed into the right JS types first,
 * then checked against this schema.
 */
const ConfigSchema = Type.Object({
  port: Type.Integer({ minimum: 1, maximum: 65535 }),
  bind: Type.String({ minLength: 1 }),
  apiTokens: Type.Array(Type.String({ minLength: 1 })),
  allowInsecure: Type.Boolean(),
  maxConcurrentScrapes: Type.Integer({ minimum: 1 }),
  queueLimit: Type.Integer({ minimum: 0 }),
  jobResultTtlSeconds: Type.Integer({ minimum: 0 }),
  syncScrapeTimeoutSeconds: Type.Integer({ minimum: 1 }),
  otpWaitTimeoutSeconds: Type.Integer({ minimum: 1 }),
  chromiumPath: Type.String({ minLength: 1 }),
  failureScreenshotsDir: Type.Optional(Type.String({ minLength: 1 })),
  logLevel: Type.Union(LOG_LEVELS.map((l) => Type.Literal(l))),
  rateLimit: Type.Object({
    max: Type.Integer({ minimum: 1 }),
    timeWindowSeconds: Type.Integer({ minimum: 1 }),
  }),
});

export type Config = Static<typeof ConfigSchema> & { warnings: string[] };

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

function parseNumber(name: string, raw: string | undefined, def: number, errors: string[]): number {
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    errors.push(`${name} must be a number (got "${raw}")`);
    return def;
  }
  return n;
}

function parseBoolean(
  name: string,
  raw: string | undefined,
  def: boolean,
  errors: string[],
): boolean {
  if (raw === undefined || raw === '') return def;
  const v = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  errors.push(`${name} must be a boolean (got "${raw}")`);
  return def;
}

function parseTokens(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * loadConfig parses and validates configuration from the environment. It throws
 * {@link ConfigError} (aggregating every problem) on invalid input, and records
 * non-fatal security advisories in `warnings` for the caller to log at boot.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const errors: string[] = [];

  const apiTokens = parseTokens(env.API_TOKENS);
  const allowInsecure = parseBoolean('ALLOW_INSECURE', env.ALLOW_INSECURE, false, errors);
  let bind = env.BIND && env.BIND.trim() !== '' ? env.BIND.trim() : '0.0.0.0';
  const warnings: string[] = [];

  // Security: never expose an unauthenticated API on a public interface unless
  // the operator explicitly opts in. Without tokens we clamp to loopback and
  // warn loudly; ALLOW_INSECURE keeps the requested bind but still warns.
  if (apiTokens.length === 0) {
    const isLoopback = LOOPBACK.has(bind);
    if (isLoopback) {
      warnings.push('No API_TOKENS set: the API is unauthenticated (bound to loopback only).');
    } else if (allowInsecure) {
      warnings.push(
        `No API_TOKENS set but ALLOW_INSECURE=true: serving an UNAUTHENTICATED API on ${bind}. This is insecure.`,
      );
    } else {
      warnings.push(
        `No API_TOKENS set: refusing to bind ${bind}; clamping to 127.0.0.1. Set API_TOKENS or ALLOW_INSECURE=true to change this.`,
      );
      bind = '127.0.0.1';
    }
  }

  const candidate = {
    port: parseNumber('PORT', env.PORT, 8080, errors),
    bind,
    apiTokens,
    allowInsecure,
    maxConcurrentScrapes: parseNumber(
      'MAX_CONCURRENT_SCRAPES',
      env.MAX_CONCURRENT_SCRAPES,
      2,
      errors,
    ),
    queueLimit: parseNumber('QUEUE_LIMIT', env.QUEUE_LIMIT, 20, errors),
    jobResultTtlSeconds: parseNumber(
      'JOB_RESULT_TTL_SECONDS',
      env.JOB_RESULT_TTL_SECONDS,
      900,
      errors,
    ),
    syncScrapeTimeoutSeconds: parseNumber(
      'SYNC_SCRAPE_TIMEOUT_SECONDS',
      env.SYNC_SCRAPE_TIMEOUT_SECONDS,
      240,
      errors,
    ),
    otpWaitTimeoutSeconds: parseNumber(
      'OTP_WAIT_TIMEOUT_SECONDS',
      env.OTP_WAIT_TIMEOUT_SECONDS,
      300,
      errors,
    ),
    chromiumPath:
      env.CHROMIUM_PATH && env.CHROMIUM_PATH.trim() !== ''
        ? env.CHROMIUM_PATH.trim()
        : '/usr/bin/chromium',
    ...(env.FAILURE_SCREENSHOTS_DIR && env.FAILURE_SCREENSHOTS_DIR.trim() !== ''
      ? { failureScreenshotsDir: env.FAILURE_SCREENSHOTS_DIR.trim() }
      : {}),
    logLevel: (env.LOG_LEVEL && env.LOG_LEVEL.trim() !== ''
      ? env.LOG_LEVEL.trim()
      : 'info') as (typeof LOG_LEVELS)[number],
    rateLimit: {
      max: parseNumber('RATE_LIMIT_MAX', env.RATE_LIMIT_MAX, 10, errors),
      timeWindowSeconds: parseNumber(
        'RATE_LIMIT_WINDOW_SECONDS',
        env.RATE_LIMIT_WINDOW_SECONDS,
        900,
        errors,
      ),
    },
  };

  // Schema-level validation (ranges, enums) via TypeBox — the authority on shape.
  for (const e of Value.Errors(ConfigSchema, candidate)) {
    const field = e.path.replace(/^\//, '').replace(/\//g, '.') || '(root)';
    errors.push(`${envNameFor(field)}: ${e.message}`);
  }

  if (errors.length > 0) {
    throw new ConfigError(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);
  }

  return { ...(candidate as Static<typeof ConfigSchema>), warnings };
}

/** Maps an internal config field path back to its env var name for error messages. */
function envNameFor(field: string): string {
  const map: Record<string, string> = {
    port: 'PORT',
    bind: 'BIND',
    apiTokens: 'API_TOKENS',
    allowInsecure: 'ALLOW_INSECURE',
    maxConcurrentScrapes: 'MAX_CONCURRENT_SCRAPES',
    queueLimit: 'QUEUE_LIMIT',
    jobResultTtlSeconds: 'JOB_RESULT_TTL_SECONDS',
    syncScrapeTimeoutSeconds: 'SYNC_SCRAPE_TIMEOUT_SECONDS',
    otpWaitTimeoutSeconds: 'OTP_WAIT_TIMEOUT_SECONDS',
    chromiumPath: 'CHROMIUM_PATH',
    failureScreenshotsDir: 'FAILURE_SCREENSHOTS_DIR',
    logLevel: 'LOG_LEVEL',
    'rateLimit.max': 'RATE_LIMIT_MAX',
    'rateLimit.timeWindowSeconds': 'RATE_LIMIT_WINDOW_SECONDS',
  };
  return map[field] ?? field;
}
