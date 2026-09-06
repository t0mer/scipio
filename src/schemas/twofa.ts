import { Type, type Static } from '@sinclair/typebox';

/** OneZero: request an OTP be sent to the given phone number. */
export const TwoFaTriggerRequest = Type.Object(
  {
    companyId: Type.Literal('oneZero'),
    phoneNumber: Type.String({ minLength: 1, description: 'Phone number to receive the OTP.' }),
  },
  { title: 'TwoFaTriggerRequest', additionalProperties: false },
);
export type TwoFaTriggerRequest = Static<typeof TwoFaTriggerRequest>;

export const TwoFaTriggerResponse = Type.Object(
  { success: Type.Boolean() },
  { title: 'TwoFaTriggerResponse', additionalProperties: false },
);
export type TwoFaTriggerResponse = Static<typeof TwoFaTriggerResponse>;

/** OneZero: exchange an OTP code for a reusable long-term 2FA token. */
export const TwoFaLongTermTokenRequest = Type.Object(
  {
    companyId: Type.Literal('oneZero'),
    otpCode: Type.String({ minLength: 1, description: 'The OTP code received by the user.' }),
  },
  {
    title: 'TwoFaLongTermTokenRequest',
    additionalProperties: false,
  },
);
export type TwoFaLongTermTokenRequest = Static<typeof TwoFaLongTermTokenRequest>;

export const TwoFaLongTermTokenResponse = Type.Object(
  {
    longTermTwoFactorAuthToken: Type.String({
      description: 'Store this client-side and pass it as otpLongTermToken in future scrapes.',
    }),
  },
  {
    title: 'TwoFaLongTermTokenResponse',
    additionalProperties: false,
  },
);
export type TwoFaLongTermTokenResponse = Static<typeof TwoFaLongTermTokenResponse>;
