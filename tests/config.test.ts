import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigError } from '../src/config.js';

/** Minimal env with tokens so the security clamp does not interfere. */
const withTokens = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  API_TOKENS: 'secret-token',
  ...extra,
});

describe('loadConfig', () => {
  it('applies documented defaults', () => {
    const cfg = loadConfig(withTokens());
    expect(cfg.port).toBe(8080);
    expect(cfg.bind).toBe('0.0.0.0');
    expect(cfg.maxConcurrentScrapes).toBe(2);
    expect(cfg.queueLimit).toBe(20);
    expect(cfg.jobResultTtlSeconds).toBe(900);
    expect(cfg.syncScrapeTimeoutSeconds).toBe(240);
    expect(cfg.otpWaitTimeoutSeconds).toBe(300);
    expect(cfg.chromiumPath).toBe('/usr/bin/chromium');
    expect(cfg.failureScreenshotsDir).toBeUndefined();
    expect(cfg.logLevel).toBe('info');
    expect(cfg.rateLimit).toEqual({ max: 10, timeWindowSeconds: 900 });
  });

  it('parses API_TOKENS as a trimmed, non-empty list', () => {
    const cfg = loadConfig({ API_TOKENS: ' a, b ,, c ' });
    expect(cfg.apiTokens).toEqual(['a', 'b', 'c']);
  });

  it('overrides numeric values from env', () => {
    const cfg = loadConfig(
      withTokens({
        PORT: '9000',
        MAX_CONCURRENT_SCRAPES: '4',
        QUEUE_LIMIT: '5',
        JOB_RESULT_TTL_SECONDS: '60',
        RATE_LIMIT_MAX: '3',
        RATE_LIMIT_WINDOW_SECONDS: '120',
      }),
    );
    expect(cfg.port).toBe(9000);
    expect(cfg.maxConcurrentScrapes).toBe(4);
    expect(cfg.queueLimit).toBe(5);
    expect(cfg.jobResultTtlSeconds).toBe(60);
    expect(cfg.rateLimit).toEqual({ max: 3, timeWindowSeconds: 120 });
  });

  it('includes failureScreenshotsDir only when set', () => {
    const cfg = loadConfig(withTokens({ FAILURE_SCREENSHOTS_DIR: '/data/shots' }));
    expect(cfg.failureScreenshotsDir).toBe('/data/shots');
  });

  describe('insecure binding rules', () => {
    it('clamps bind to loopback and warns when no tokens on a public bind', () => {
      const cfg = loadConfig({ BIND: '0.0.0.0' });
      expect(cfg.bind).toBe('127.0.0.1');
      expect(cfg.warnings.join(' ')).toMatch(/no api_tokens/i);
    });

    it('keeps a public bind without tokens when ALLOW_INSECURE=true (with warning)', () => {
      const cfg = loadConfig({ BIND: '0.0.0.0', ALLOW_INSECURE: 'true' });
      expect(cfg.bind).toBe('0.0.0.0');
      expect(cfg.warnings.join(' ')).toMatch(/insecure/i);
    });

    it('does not clamp a loopback bind without tokens', () => {
      const cfg = loadConfig({ BIND: '127.0.0.1' });
      expect(cfg.bind).toBe('127.0.0.1');
    });

    it('does not warn or clamp when tokens are present', () => {
      const cfg = loadConfig(withTokens({ BIND: '0.0.0.0' }));
      expect(cfg.bind).toBe('0.0.0.0');
      expect(cfg.warnings).toEqual([]);
    });
  });

  describe('validation failures', () => {
    it('rejects a non-numeric PORT', () => {
      expect(() => loadConfig(withTokens({ PORT: 'abc' }))).toThrow(ConfigError);
    });

    it('rejects an out-of-range PORT', () => {
      expect(() => loadConfig(withTokens({ PORT: '70000' }))).toThrow(ConfigError);
    });

    it('rejects a non-positive concurrency', () => {
      expect(() => loadConfig(withTokens({ MAX_CONCURRENT_SCRAPES: '0' }))).toThrow(ConfigError);
    });

    it('rejects an unknown LOG_LEVEL', () => {
      expect(() => loadConfig(withTokens({ LOG_LEVEL: 'chatty' }))).toThrow(ConfigError);
    });

    it('rejects an invalid boolean for ALLOW_INSECURE', () => {
      expect(() => loadConfig(withTokens({ ALLOW_INSECURE: 'maybe' }))).toThrow(ConfigError);
    });

    it('aggregates multiple errors into one message', () => {
      try {
        loadConfig(withTokens({ PORT: 'abc', LOG_LEVEL: 'chatty' }));
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).message).toMatch(/PORT/);
        expect((err as ConfigError).message).toMatch(/LOG_LEVEL/);
      }
    });
  });
});
