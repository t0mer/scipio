import {
  createScraper as createScraperDefault,
  type CompanyTypes,
  type Scraper,
  type ScraperCredentials,
  type ScraperOptions,
} from 'israeli-bank-scrapers-core';
import type { BrowserContext } from 'puppeteer-core';
import type { Credentials, ScrapeOptions, ScrapeResult } from '../schemas/index.js';
import type { ProgressEvent } from '../schemas/jobs.js';
import type { OtpBridge } from './otp.js';
import { OtpTimeoutError } from './otp.js';

/** Raised when the request is structurally valid but cannot be scraped as asked
 * (e.g. OneZero with neither a token nor an interactive OTP flow). Routes map
 * this to HTTP 422. */
export class ScrapeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScrapeInputError';
  }
}

/** Library scrape options we set, minus the server-controlled browser fields
 * (which the runner supplies). Declared explicitly to avoid the union-type
 * pitfalls of `Omit` over the library's browser-options union. */
interface MappedScraperOptions {
  companyId: CompanyTypes;
  startDate: Date;
  showBrowser: false;
  combineInstallments?: boolean;
  futureMonthsToScrape?: number;
  additionalTransactionInformation?: boolean;
  includeRawTransaction?: boolean;
  verbose?: boolean;
  timeout?: number;
  defaultTimeout?: number;
  navigationRetryCount?: number;
  viewportSize?: { width: number; height: number };
  outputData?: { enableTransactionsFilterByDate?: boolean };
  optInFeatures?: ScrapeOptions['optInFeatures'];
  storeFailureScreenShotPath?: string;
}

/** A scoped browser context plus the function to tear it down. */
export interface AcquiredContext {
  context: BrowserContext;
  release: () => Promise<void>;
}

export type ScraperFactory = (options: ScraperOptions) => Scraper<ScraperCredentials>;

export interface RunnerDependencies {
  createScraper?: ScraperFactory;
  acquireContext: () => Promise<AcquiredContext>;
}

export interface RunnerSettings {
  failureScreenshotsDir?: string;
}

export interface RunContext {
  onProgress?: (event: ProgressEvent) => void;
  otpBridge?: OtpBridge;
  /** Identifier used to name a failure screenshot, when enabled. */
  screenshotId?: string;
}

/**
 * Maps API scrape options to the library's option object, copying only the
 * fields that are present so the mapping is explicit and testable field by field.
 * `companyId`/`startDate` are always set; browser fields are added by the runner.
 */
export function mapOptions(
  companyId: string,
  options: ScrapeOptions,
  settings: RunnerSettings = {},
  screenshotId?: string,
): MappedScraperOptions {
  const startDate = new Date(options.startDate);
  if (Number.isNaN(startDate.getTime())) {
    throw new ScrapeInputError(`Invalid startDate: ${options.startDate}`);
  }

  const mapped: MappedScraperOptions = {
    companyId: companyId as CompanyTypes,
    startDate,
    showBrowser: false,
  };

  const target = mapped as unknown as Record<string, unknown>;
  const copyIfDefined = <K extends keyof ScrapeOptions>(key: K): void => {
    if (options[key] !== undefined) {
      target[key] = options[key];
    }
  };

  copyIfDefined('combineInstallments');
  copyIfDefined('futureMonthsToScrape');
  copyIfDefined('additionalTransactionInformation');
  copyIfDefined('includeRawTransaction');
  copyIfDefined('verbose');
  copyIfDefined('timeout');
  copyIfDefined('defaultTimeout');
  copyIfDefined('navigationRetryCount');
  copyIfDefined('viewportSize');
  copyIfDefined('outputData');
  copyIfDefined('optInFeatures');

  if (settings.failureScreenshotsDir && screenshotId) {
    mapped.storeFailureScreenShotPath = `${settings.failureScreenshotsDir}/${screenshotId}.png`;
  }

  return mapped;
}

/**
 * Extracts the library credential object from the API credentials, stripping the
 * `companyId` discriminator and wiring the OneZero 2FA method (long-term token,
 * or interactive OTP via the bridge).
 */
export function extractCredentials(
  credentials: Credentials,
  otpBridge?: OtpBridge,
): { companyId: string; libraryCredentials: ScraperCredentials } {
  const record = { ...(credentials as unknown as Record<string, unknown>) };
  const companyId = record.companyId as string;
  delete record.companyId;
  const rest = record;

  if (companyId === 'oneZero') {
    const { email, password, phoneNumber, otpLongTermToken } = rest as {
      email: string;
      password: string;
      phoneNumber?: string;
      otpLongTermToken?: string;
    };
    if (otpLongTermToken) {
      return {
        companyId,
        libraryCredentials: { email, password, otpLongTermToken } as ScraperCredentials,
      };
    }
    if (otpBridge && phoneNumber) {
      return {
        companyId,
        libraryCredentials: {
          email,
          password,
          phoneNumber,
          otpCodeRetriever: otpBridge.retriever,
        } as ScraperCredentials,
      };
    }
    throw new ScrapeInputError(
      'oneZero requires either otpLongTermToken (any flow) or phoneNumber via an async job (interactive OTP).',
    );
  }

  return { companyId, libraryCredentials: rest as ScraperCredentials };
}

/**
 * Orchestrates a single scrape: acquires an isolated browser context, wires
 * progress and OTP, runs the library scraper, and always releases the context.
 * Library/scrape failures are returned as `{ success: false, errorType }` — only
 * infrastructure faults are normalised to a GENERIC result.
 */
export class ScrapeRunner {
  private readonly createScraper: ScraperFactory;

  constructor(
    private readonly deps: RunnerDependencies,
    private readonly settings: RunnerSettings = {},
  ) {
    this.createScraper = deps.createScraper ?? (createScraperDefault as ScraperFactory);
  }

  async run(
    request: { credentials: Credentials; options: ScrapeOptions },
    ctx: RunContext = {},
  ): Promise<ScrapeResult> {
    const { companyId, libraryCredentials } = extractCredentials(
      request.credentials,
      ctx.otpBridge,
    );
    const mapped = mapOptions(companyId, request.options, this.settings, ctx.screenshotId);

    const { context, release } = await this.deps.acquireContext();
    try {
      const scraper = this.createScraper({
        ...mapped,
        browserContext: context,
      } as ScraperOptions);

      if (ctx.onProgress) {
        const onProgress = ctx.onProgress;
        scraper.onProgress((_companyId, payload) => {
          onProgress({ type: payload.type, at: new Date().toISOString() });
        });
      }

      const result = await scraper.scrape(libraryCredentials);
      return result as ScrapeResult;
    } catch (err) {
      if (err instanceof OtpTimeoutError) {
        return { success: false, errorType: 'TIMEOUT', errorMessage: err.message };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, errorType: 'GENERIC', errorMessage: message };
    } finally {
      await release().catch(() => undefined);
    }
  }
}
