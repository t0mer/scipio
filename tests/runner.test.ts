import { describe, it, expect, vi } from 'vitest';
import type { BrowserContext } from 'puppeteer-core';
import {
  mapOptions,
  extractCredentials,
  ScrapeRunner,
  ScrapeInputError,
  type ScraperFactory,
} from '../src/scraper/runner.js';
import { OtpBridge, OtpTimeoutError } from '../src/scraper/otp.js';
import type { Credentials, ScrapeOptions, ScrapeResult } from '../src/schemas/index.js';

const fakeContext = {} as BrowserContext;

/** Builds runner deps with a scriptable fake scraper and a release spy. */
function makeDeps(scrape: (creds: unknown) => Promise<ScrapeResult> | ScrapeResult) {
  const release = vi.fn(async () => undefined);
  const onProgressHandlers: Array<(c: unknown, p: { type: string }) => void> = [];
  const scraper = {
    scrape: vi.fn(scrape),
    onProgress: vi.fn((fn: (c: unknown, p: { type: string }) => void) =>
      onProgressHandlers.push(fn),
    ),
    triggerTwoFactorAuth: vi.fn(),
    getLongTermTwoFactorToken: vi.fn(),
  };
  const createScraper = vi.fn(() => scraper) as unknown as ScraperFactory;
  const acquireContext = vi.fn(async () => ({ context: fakeContext, release }));
  return { deps: { createScraper, acquireContext }, scraper, release, onProgressHandlers };
}

describe('mapOptions', () => {
  const full: ScrapeOptions = {
    startDate: '2024-01-01',
    combineInstallments: true,
    futureMonthsToScrape: 2,
    additionalTransactionInformation: true,
    includeRawTransaction: true,
    verbose: true,
    timeout: 60000,
    defaultTimeout: 30000,
    navigationRetryCount: 3,
    viewportSize: { width: 1024, height: 768 },
    outputData: { enableTransactionsFilterByDate: true },
    optInFeatures: ['mizrahi:pendingIfNoIdentifier'],
  };

  it('maps every API option field to the library option', () => {
    const mapped = mapOptions('mizrahi', full) as unknown as Record<string, unknown>;
    expect(mapped.companyId).toBe('mizrahi');
    expect(mapped.startDate).toBeInstanceOf(Date);
    expect((mapped.startDate as Date).toISOString().startsWith('2024-01-01')).toBe(true);
    expect(mapped.showBrowser).toBe(false);
    expect(mapped.combineInstallments).toBe(true);
    expect(mapped.futureMonthsToScrape).toBe(2);
    expect(mapped.additionalTransactionInformation).toBe(true);
    expect(mapped.includeRawTransaction).toBe(true);
    expect(mapped.verbose).toBe(true);
    expect(mapped.timeout).toBe(60000);
    expect(mapped.defaultTimeout).toBe(30000);
    expect(mapped.navigationRetryCount).toBe(3);
    expect(mapped.viewportSize).toEqual({ width: 1024, height: 768 });
    expect(mapped.outputData).toEqual({ enableTransactionsFilterByDate: true });
    expect(mapped.optInFeatures).toEqual(['mizrahi:pendingIfNoIdentifier']);
  });

  it('omits fields that are not provided', () => {
    const mapped = mapOptions('leumi', { startDate: '2024-01-01' }) as unknown as Record<
      string,
      unknown
    >;
    expect('combineInstallments' in mapped).toBe(false);
    expect('viewportSize' in mapped).toBe(false);
  });

  it('adds a failure screenshot path only when enabled and an id is given', () => {
    const withShot = mapOptions(
      'leumi',
      { startDate: '2024-01-01' },
      { failureScreenshotsDir: '/shots' },
      'job1',
    );
    expect((withShot as unknown as Record<string, unknown>).storeFailureScreenShotPath).toBe(
      '/shots/job1.png',
    );
    const withoutId = mapOptions(
      'leumi',
      { startDate: '2024-01-01' },
      { failureScreenshotsDir: '/shots' },
    );
    expect('storeFailureScreenShotPath' in withoutId).toBe(false);
  });

  it('throws on an unparseable startDate', () => {
    expect(() => mapOptions('leumi', { startDate: 'nonsense' })).toThrow(ScrapeInputError);
  });
});

describe('extractCredentials', () => {
  it('strips companyId for a normal company', () => {
    const creds: Credentials = { companyId: 'leumi', username: 'u', password: 'p' };
    const { companyId, libraryCredentials } = extractCredentials(creds);
    expect(companyId).toBe('leumi');
    expect(libraryCredentials).toEqual({ username: 'u', password: 'p' });
  });

  it('uses the long-term token for oneZero when present', () => {
    const creds: Credentials = {
      companyId: 'oneZero',
      email: 'a@b.co',
      password: 'p',
      otpLongTermToken: 'tok',
    };
    const { libraryCredentials } = extractCredentials(creds);
    expect(libraryCredentials).toEqual({ email: 'a@b.co', password: 'p', otpLongTermToken: 'tok' });
  });

  it('wires the interactive OTP retriever for oneZero when a bridge + phone are given', () => {
    const creds: Credentials = {
      companyId: 'oneZero',
      email: 'a@b.co',
      password: 'p',
      phoneNumber: '972500000000',
    };
    const bridge = new OtpBridge({ timeoutMs: 1000 });
    const { libraryCredentials } = extractCredentials(creds, bridge);
    expect((libraryCredentials as Record<string, unknown>).phoneNumber).toBe('972500000000');
    expect((libraryCredentials as Record<string, unknown>).otpCodeRetriever).toBe(bridge.retriever);
  });

  it('throws when oneZero has neither a token nor an interactive OTP path', () => {
    const creds: Credentials = { companyId: 'oneZero', email: 'a@b.co', password: 'p' };
    expect(() => extractCredentials(creds)).toThrow(ScrapeInputError);
  });
});

describe('ScrapeRunner.run', () => {
  const req = {
    credentials: { companyId: 'leumi', username: 'u', password: 'p' } as Credentials,
    options: { startDate: '2024-01-01' } as ScrapeOptions,
  };

  it('runs the scraper and returns its result, releasing the context', async () => {
    const okResult: ScrapeResult = { success: true, accounts: [] };
    const { deps, scraper, release } = makeDeps(() => okResult);
    const runner = new ScrapeRunner(deps);
    const result = await runner.run(req);
    expect(result).toEqual(okResult);
    expect(scraper.scrape).toHaveBeenCalledWith({ username: 'u', password: 'p' });
    expect(release).toHaveBeenCalledOnce();
  });

  it('forwards progress events with timestamps', async () => {
    const { deps, onProgressHandlers } = makeDeps(async () => {
      onProgressHandlers.forEach((fn) => fn('leumi', { type: 'LOGGING_IN' }));
      return { success: true };
    });
    const events: string[] = [];
    const runner = new ScrapeRunner(deps);
    await runner.run(req, { onProgress: (e) => events.push(e.type) });
    expect(events).toContain('LOGGING_IN');
  });

  it('normalises an OTP timeout to a TIMEOUT result and releases the context', async () => {
    const { deps, release } = makeDeps(() => {
      throw new OtpTimeoutError();
    });
    const runner = new ScrapeRunner(deps);
    const result = await runner.run(req);
    expect(result).toEqual({
      success: false,
      errorType: 'TIMEOUT',
      errorMessage: expect.any(String),
    });
    expect(release).toHaveBeenCalledOnce();
  });

  it('sanitizes non-finite numbers in the scrape result to null', async () => {
    const dirty = {
      success: true,
      accounts: [
        {
          accountNumber: '1',
          balance: NaN,
          txns: [
            {
              type: 'normal',
              date: '2024-01-01',
              processedDate: '2024-01-01',
              originalAmount: Infinity,
              originalCurrency: 'ILS',
              chargedAmount: 12.5,
              description: 'x',
              status: 'completed',
            },
          ],
        },
      ],
    } as unknown as ScrapeResult;
    const { deps } = makeDeps(() => dirty);
    const runner = new ScrapeRunner(deps);
    const result = (await runner.run(req)) as unknown as Record<string, unknown>;
    const account = (result.accounts as Array<Record<string, unknown>>)[0]!;
    expect(account.balance).toBeNull();
    const txn = (account.txns as Array<Record<string, unknown>>)[0]!;
    expect(txn.originalAmount).toBeNull();
    expect(txn.chargedAmount).toBe(12.5); // finite values untouched
  });

  it('normalises an unexpected throw to a GENERIC result', async () => {
    const { deps } = makeDeps(() => {
      throw new Error('boom');
    });
    const runner = new ScrapeRunner(deps);
    const result = await runner.run(req);
    expect(result).toEqual({ success: false, errorType: 'GENERIC', errorMessage: 'boom' });
  });
});
