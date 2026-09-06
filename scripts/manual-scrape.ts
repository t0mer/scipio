/**
 * Local, real-credential smoke test. NOT used in CI. Credentials are read from
 * the environment only (never argv, never logged).
 *
 * Usage:
 *   SCIPIO_CREDENTIALS='{"companyId":"leumi","username":"...","password":"..."}' \
 *   SCIPIO_START_DATE=2024-01-01 \
 *   npm run scrape:manual
 */
import { loadConfig } from '../src/config.js';
import { createServices } from '../src/services.js';
import type { Credentials } from '../src/schemas/index.js';

async function main(): Promise<void> {
  const raw = process.env.SCIPIO_CREDENTIALS;
  if (!raw) {
    console.error('Set SCIPIO_CREDENTIALS to a JSON credentials object (including companyId).');
    process.exit(2);
  }

  const credentials = JSON.parse(raw) as Credentials;
  const startDate =
    process.env.SCIPIO_START_DATE ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const services = createServices(loadConfig());
  try {
    const result = await services.runner.run(
      { credentials, options: { startDate } },
      { onProgress: (e) => console.log(`[progress] ${e.type}`) },
    );
    console.log(`success=${result.success} accounts=${result.accounts?.length ?? 0}`);
    if (!result.success) {
      console.log(`errorType=${result.errorType} errorMessage=${result.errorMessage}`);
    }
    for (const account of result.accounts ?? []) {
      console.log(`  account ${account.accountNumber}: ${account.txns.length} txns`);
    }
  } finally {
    await services.close();
  }
}

void main();
