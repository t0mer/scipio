import { buildApp } from './app.js';
import { loadConfig, ConfigError } from './config.js';

/**
 * Entrypoint: parses and validates configuration, builds the app, and starts
 * listening. Invalid configuration is fatal (non-zero exit with a clear
 * message); security advisories are surfaced before binding.
 */
async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  for (const warning of config.warnings) {
    console.warn(`[config] ${warning}`);
  }

  const app = await buildApp(config);

  try {
    await app.listen({ port: config.port, host: config.bind });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

void main();
