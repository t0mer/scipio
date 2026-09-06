import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import { version } from '../version.js';

/**
 * Registers the OpenAPI 3.1 document generator (from the route schemas) and
 * serves Swagger UI at /docs and the raw document at /openapi.json.
 */
export async function registerSwagger(app: FastifyInstance, config: Config): Promise<void> {
  const authenticated = config.apiTokens.length > 0;

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Scipio',
        description:
          'Self-hosted RESTful API around israeli-bank-scrapers. Credentials pass through per request and are never persisted.',
        version,
        license: { name: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
      },
      tags: [
        { name: 'system', description: 'Health, readiness, version, metrics.' },
        { name: 'companies', description: 'Supported companies and login fields.' },
        { name: 'scrape', description: 'Synchronous scraping.' },
        { name: 'jobs', description: 'Asynchronous scrape jobs and OTP submission.' },
        { name: '2fa', description: 'OneZero two-factor helpers.' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
          apiToken: { type: 'apiKey', in: 'header', name: 'X-API-Token' },
        },
      },
      ...(authenticated ? { security: [{ bearerAuth: [] }, { apiToken: [] }] } : {}),
    },
  });

  await app.register(fastifySwaggerUi, { routePrefix: '/docs' });

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
}
