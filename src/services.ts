import { createScraper } from 'israeli-bank-scrapers-core';
import type { Config } from './config.js';
import { createMetrics, type Metrics } from './metrics.js';
import { BrowserManager } from './scraper/browser.js';
import { ScrapeRunner, type ScrapeRunnerLike, type ScraperFactory } from './scraper/runner.js';
import { TwoFactorManager } from './scraper/twofa.js';
import { JobStore } from './jobs/store.js';
import { JobManager } from './jobs/queue.js';

/** The application's long-lived services, shared across requests. */
export interface Services {
  browser: BrowserManager;
  runner: ScrapeRunnerLike;
  jobs: JobManager;
  twoFactor: TwoFactorManager;
  metrics: Metrics;
  close(): Promise<void>;
}

/** Wires the concrete service graph from configuration. */
export function createServices(config: Config): Services {
  const metrics = createMetrics();
  const browser = new BrowserManager({
    executablePath: config.chromiumPath,
    extraArgs: config.chromiumArgs,
  });
  const acquireContext = () => browser.acquireContext();

  const runner = new ScrapeRunner(
    { acquireContext },
    { failureScreenshotsDir: config.failureScreenshotsDir },
  );

  const store = new JobStore(config.jobResultTtlSeconds * 1000);
  const jobs = new JobManager(runner, store, {
    maxConcurrent: config.maxConcurrentScrapes,
    queueLimit: config.queueLimit,
    otpWaitTimeoutMs: config.otpWaitTimeoutSeconds * 1000,
    screenshotsEnabled: Boolean(config.failureScreenshotsDir),
    onOutcome: (company, status, seconds) => metrics.observeScrape(company, status, seconds),
  });

  const twoFactor = new TwoFactorManager(
    { createScraper: createScraper as ScraperFactory, acquireContext },
    { sessionTtlMs: config.otpWaitTimeoutSeconds * 1000 },
  );

  return {
    browser,
    runner,
    jobs,
    twoFactor,
    metrics,
    close: async () => {
      await twoFactor.closeAll();
      await browser.close();
    },
  };
}
