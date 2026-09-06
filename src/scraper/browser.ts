import { existsSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
import type { AcquiredContext } from './runner.js';

/** Baseline args suitable for containers. `--no-sandbox` is intentionally NOT
 * included by default (see guidelines); operators can add it via CHROMIUM_ARGS. */
const BASE_ARGS = ['--disable-dev-shm-usage'];

export interface BrowserManagerOptions {
  executablePath: string;
  extraArgs?: string[];
}

/**
 * Owns a single shared Puppeteer {@link Browser}, launched lazily and reused
 * across scrapes. Each scrape gets its own incognito {@link BrowserContext} for
 * cookie isolation, torn down via the returned `release`.
 */
export class BrowserManager {
  private browser?: Browser;
  private launching?: Promise<Browser>;

  constructor(private readonly options: BrowserManagerOptions) {}

  /** Whether the configured Chromium executable exists on disk. */
  chromiumPresent(): boolean {
    return existsSync(this.options.executablePath);
  }

  /** Returns the shared browser, launching it once if needed. */
  async get(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;
    if (!this.launching) {
      this.launching = puppeteer
        .launch({
          executablePath: this.options.executablePath,
          headless: true,
          args: [...BASE_ARGS, ...(this.options.extraArgs ?? [])],
        })
        .then((b) => {
          this.browser = b;
          this.launching = undefined;
          return b;
        })
        .catch((err) => {
          this.launching = undefined;
          throw err;
        });
    }
    return this.launching;
  }

  /** Acquires an isolated context; `release` closes it. */
  async acquireContext(): Promise<AcquiredContext> {
    const browser = await this.get();
    const context = await browser.createBrowserContext();
    return {
      context,
      release: async () => {
        await context.close().catch(() => undefined);
      },
    };
  }

  /** Readiness probe: Chromium present and launchable. */
  async probe(): Promise<boolean> {
    if (!this.chromiumPresent()) return false;
    try {
      await this.get();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = undefined;
    }
  }
}
