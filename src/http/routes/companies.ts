import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { CompaniesResponse } from '../../schemas/companies.js';
import { companiesResponse } from '../../scraper/companies.js';

/** GET /companies — supported companies, login fields, 2FA, opt-in features. */
export async function companiesRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  typed.get(
    '/companies',
    {
      schema: {
        tags: ['companies'],
        summary: 'List supported companies and their login fields',
        response: { 200: CompaniesResponse },
      },
    },
    async () => companiesResponse(),
  );
}
