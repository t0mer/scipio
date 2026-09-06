import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { Config } from './config.js';
import { createServices, type Services } from './services.js';
import { loggerOptions } from './http/logging.js';
import { registerAuth } from './http/auth.js';
import { registerErrorHandler } from './http/errors.js';
import { registerSwagger } from './http/swagger.js';
import { systemRoutes } from './http/routes/system.js';
import { companiesRoutes } from './http/routes/companies.js';
import { scrapeRoutes } from './http/routes/scrape.js';
import { jobsRoutes } from './http/routes/jobs.js';
import { twoFaRoutes } from './http/routes/twofa.js';

/** Rate-limit key: the API token if present, otherwise the client IP. */
function rateLimitKey(req: FastifyRequest): string {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const apiToken = req.headers['x-api-token'];
  if (typeof apiToken === 'string' && apiToken.trim() !== '') return apiToken.trim();
  return req.ip;
}

export interface BuildAppOptions {
  /** Inject pre-built services (used by tests to avoid launching Chromium). */
  services?: Services;
}

/**
 * buildApp constructs the Fastify application without starting the network
 * listener, so it can be exercised in tests via `app.inject()`.
 */
export async function buildApp(
  config: Config,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    // Request bodies are never logged by Fastify (only method/url/ip in the
    // request line), so credentials cannot leak via request logs. Redaction
    // censors headers and any body accidentally passed to the logger.
    logger: loggerOptions(config.logLevel),
    ajv: { customOptions: { allErrors: true, coerceTypes: false, removeAdditional: false } },
  });

  const services = options.services ?? createServices(config);
  app.decorate('config', config);
  app.decorate('services', services);
  app.addHook('onClose', async () => {
    await services.close();
  });

  await registerSwagger(app, config);
  await app.register(rateLimit, { global: false, keyGenerator: rateLimitKey });

  registerAuth(app, config);
  registerErrorHandler(app);

  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions?.url ?? req.url;
    services.metrics.observeHttp(req.method, route, reply.statusCode);
  });

  await app.register(systemRoutes);
  await app.register(
    async (api) => {
      await api.register(companiesRoutes);
      await api.register(scrapeRoutes);
      await api.register(jobsRoutes);
      await api.register(twoFaRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    services: Services;
  }
}
