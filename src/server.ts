import { buildApp } from './app.js';

/**
 * Entrypoint: builds the app and starts listening. Configuration parsing and
 * validation are wired in a later step; a hardcoded default is used for now.
 */
async function main(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.BIND ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

void main();
