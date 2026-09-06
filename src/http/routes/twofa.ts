import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  TwoFaTriggerRequest,
  TwoFaTriggerResponse,
  TwoFaLongTermTokenRequest,
  TwoFaLongTermTokenResponse,
} from '../../schemas/twofa.js';
import { ErrorEnvelope, errorEnvelope } from '../../schemas/common.js';

/** OneZero 2FA helpers: trigger an OTP, then exchange it for a long-term token. */
export async function twoFaRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  const rateLimit = {
    rateLimit: {
      max: app.config.rateLimit.max,
      timeWindow: app.config.rateLimit.timeWindowSeconds * 1000,
    },
  };

  typed.post(
    '/2fa/trigger',
    {
      config: rateLimit,
      schema: {
        tags: ['2fa'],
        summary: 'OneZero: send an OTP to a phone number',
        body: TwoFaTriggerRequest,
        response: { 200: TwoFaTriggerResponse, 429: ErrorEnvelope },
      },
    },
    async (req) => {
      const result = await app.services.twoFactor.trigger(req.body.companyId, req.body.phoneNumber);
      return { success: result.success };
    },
  );

  typed.post(
    '/2fa/long-term-token',
    {
      config: rateLimit,
      schema: {
        tags: ['2fa'],
        summary: 'OneZero: exchange an OTP code for a long-term token',
        body: TwoFaLongTermTokenRequest,
        response: {
          200: TwoFaLongTermTokenResponse,
          400: ErrorEnvelope,
          409: ErrorEnvelope,
          429: ErrorEnvelope,
        },
      },
    },
    async (req, reply) => {
      const result = await app.services.twoFactor.getLongTermToken(
        req.body.companyId,
        req.body.otpCode,
      );
      if (!result.success) {
        return reply.code(400).send(errorEnvelope('OTP_REJECTED', result.errorMessage));
      }
      return reply
        .code(200)
        .send({ longTermTwoFactorAuthToken: result.longTermTwoFactorAuthToken });
    },
  );
}
