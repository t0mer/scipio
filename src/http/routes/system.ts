import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { HealthResponse, ReadyResponse, VersionResponse } from '../../schemas/system.js';
import { version, commit, libraryVersion } from '../../version.js';

/** Liveness, readiness, version, and metrics — all public (no auth). */
export async function systemRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/healthz',
    { schema: { tags: ['system'], summary: 'Liveness', response: { 200: HealthResponse } } },
    async () => ({ status: 'ok' as const, version }),
  );

  typed.get(
    '/readyz',
    {
      schema: {
        tags: ['system'],
        summary: 'Readiness (Chromium present & launchable)',
        response: { 200: ReadyResponse, 503: ReadyResponse },
      },
    },
    async (_req, reply) => {
      const present = await app.services.browser.probe();
      return reply
        .code(present ? 200 : 503)
        .send({ status: present ? ('ok' as const) : ('unavailable' as const), chromium: present });
    },
  );

  typed.get(
    '/version',
    { schema: { tags: ['system'], summary: 'Version info', response: { 200: VersionResponse } } },
    async () => ({ version, libraryVersion: libraryVersion(), commit }),
  );

  app.get(
    '/metrics',
    { schema: { tags: ['system'], summary: 'Prometheus metrics', hide: true } },
    async (_req, reply) => {
      app.services.metrics.setQueueDepth(app.services.jobs.pendingCount());
      return reply.type(app.services.metrics.contentType).send(await app.services.metrics.render());
    },
  );
}
