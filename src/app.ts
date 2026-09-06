import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';

/**
 * buildApp constructs the Fastify application without starting the network
 * listener, so it can be exercised in tests via `app.inject()`. Plugins,
 * routes, and lifecycle wiring are layered on in later steps.
 */
export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  // Expose config to routes/plugins wired in later steps.
  app.decorate('config', config);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}
