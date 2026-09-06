import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ScrapeRequest, ScrapeResult } from '../../schemas/scrape.js';
import { ErrorEnvelope, errorEnvelope } from '../../schemas/common.js';
import { companyRequiresTwoFactor } from '../../scraper/companies.js';

/**
 * POST /scrape — synchronous scrape. Blocks until the scrape completes or the
 * server-side timeout fires (504). 2FA companies without a long-term token are
 * rejected with 422 and pointed at the async jobs flow.
 */
export async function scrapeRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    '/scrape',
    {
      config: {
        rateLimit: {
          max: app.config.rateLimit.max,
          timeWindow: app.config.rateLimit.timeWindowSeconds * 1000,
        },
      },
      schema: {
        tags: ['scrape'],
        summary: 'Synchronous scrape (not for interactive 2FA)',
        body: ScrapeRequest,
        response: {
          200: ScrapeResult,
          422: ErrorEnvelope,
          429: ErrorEnvelope,
          504: ErrorEnvelope,
        },
      },
    },
    async (req, reply) => {
      const credentials = req.body.credentials as { companyId: string; otpLongTermToken?: string };
      const companyId = credentials.companyId;

      if (companyRequiresTwoFactor(companyId) && !credentials.otpLongTermToken) {
        return reply
          .code(422)
          .send(
            errorEnvelope(
              'TWO_FACTOR_REQUIRED',
              `${companyId} needs interactive 2FA; use the async jobs flow (POST /api/v1/jobs) or supply otpLongTermToken.`,
            ),
          );
      }

      const timeoutMs = app.config.syncScrapeTimeoutSeconds * 1000;
      const startedAt = Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<'__timeout__'>((resolve) => {
        timer = setTimeout(() => resolve('__timeout__'), timeoutMs);
      });

      try {
        const outcome = await Promise.race([
          app.services.runner.run(req.body, {
            screenshotId: app.config.failureScreenshotsDir ? `sync-${Date.now()}` : undefined,
          }),
          timeout,
        ]);

        if (outcome === '__timeout__') {
          app.services.metrics.observeScrape(companyId, 'timeout', (Date.now() - startedAt) / 1000);
          return reply
            .code(504)
            .send(
              errorEnvelope('TIMEOUT', `Scrape exceeded ${app.config.syncScrapeTimeoutSeconds}s.`),
            );
        }

        app.services.metrics.observeScrape(
          companyId,
          outcome.success ? 'succeeded' : 'failed',
          (Date.now() - startedAt) / 1000,
        );
        return reply.code(200).send(outcome);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  );
}
