import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from '../config.js';
import { errorEnvelope } from '../schemas/common.js';

/** Paths that are always public (health, docs, metrics). */
const PUBLIC_PREFIXES = ['/healthz', '/readyz', '/version', '/metrics', '/docs', '/openapi.json'];

function isPublic(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Constant-time comparison of a presented token against the allow-list. */
function tokenMatches(presented: string, tokens: string[]): boolean {
  const a = Buffer.from(presented);
  let ok = false;
  for (const token of tokens) {
    const b = Buffer.from(token);
    // timingSafeEqual requires equal lengths; compare against each token.
    if (a.length === b.length && timingSafeEqual(a, b)) ok = true;
  }
  return ok;
}

function extractToken(req: FastifyRequest): string | undefined {
  const header = req.headers['authorization'];
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  const apiToken = req.headers['x-api-token'];
  if (typeof apiToken === 'string' && apiToken.trim() !== '') return apiToken.trim();
  return undefined;
}

/**
 * Registers bearer-token authentication. When no tokens are configured the API
 * runs in open bootstrap mode (documented; the config layer only permits this on
 * loopback or with ALLOW_INSECURE). Health, docs and metrics are always public.
 */
export function registerAuth(app: FastifyInstance, config: Config): void {
  if (config.apiTokens.length === 0) return; // bootstrap/open mode

  app.addHook('onRequest', async (req, reply) => {
    if (isPublic(req.url)) return;
    const token = extractToken(req);
    if (!token || !tokenMatches(token, config.apiTokens)) {
      await reply.code(401).send(errorEnvelope('UNAUTHORIZED', 'Missing or invalid API token.'));
    }
  });
}
