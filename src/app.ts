import Fastify, { type FastifyInstance } from 'fastify';

/**
 * buildApp constructs the Fastify application without starting the network
 * listener, so it can be exercised in tests via `app.inject()`. Plugins,
 * routes, and lifecycle wiring are layered on in later steps.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  return app;
}
