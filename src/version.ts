import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function readOwnVersion(): string {
  try {
    return (require('../package.json') as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

/** Service version: build-injected (SCIPIO_VERSION) or package.json fallback. */
export const version = process.env.SCIPIO_VERSION?.trim() || readOwnVersion();

/** Git commit, injected at build time when available. */
export const commit = process.env.GIT_COMMIT?.trim() || process.env.COMMIT?.trim() || 'unknown';

/** Version of the wrapped scraper library. */
export function libraryVersion(): string {
  try {
    return (require('israeli-bank-scrapers-core/package.json') as { version: string }).version;
  } catch {
    return 'unknown';
  }
}
