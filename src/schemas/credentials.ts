import { Type, type Static, type TObject } from '@sinclair/typebox';

/**
 * Per-company credential schemas, keyed by `companyId`, assembled into a
 * discriminated union. Each variant exposes exactly the login fields the
 * corresponding scraper requires, so Swagger documents them precisely and
 * validation rejects mismatched credential shapes.
 *
 * The field sets are verified against the library's `SCRAPERS` login fields by
 * a runtime test, so drift in the upstream library is caught in CI.
 */

const Password = Type.String({ minLength: 1, description: 'Account password.' });

/** Builds one credential variant with the discriminating `companyId` literal. */
function variant<const Id extends string>(
  companyId: Id,
  fields: Record<string, ReturnType<typeof Type.String>>,
): TObject {
  return Type.Object(
    { companyId: Type.Literal(companyId), ...fields },
    { additionalProperties: false, title: `${companyId}Credentials` },
  );
}

const userCode = Type.String({ minLength: 1, description: 'User code / login code.' });
const username = Type.String({ minLength: 1, description: 'Username.' });
const id = Type.String({ minLength: 1, description: 'National ID number.' });
const num = Type.String({ minLength: 1, description: 'Branch/account number.' });
const card6Digits = Type.String({ minLength: 6, maxLength: 6, description: 'Last 6 card digits.' });
const nationalID = Type.String({ minLength: 1, description: 'National ID number.' });
const email = Type.String({ minLength: 3, description: 'Account email.' });

/** OneZero: email + password, plus an optional long-term 2FA token. When the
 * token is omitted the interactive OTP flow (async jobs) is required. */
const oneZeroCredentials = Type.Object(
  {
    companyId: Type.Literal('oneZero'),
    email,
    password: Password,
    otpLongTermToken: Type.Optional(
      Type.String({
        minLength: 1,
        description: 'Long-term 2FA token from POST /2fa/long-term-token; skips the OTP prompt.',
      }),
    ),
  },
  { additionalProperties: false, title: 'oneZeroCredentials' },
);

export const CredentialVariants = [
  variant('hapoalim', { userCode, password: Password }),
  variant('leumi', { username, password: Password }),
  variant('mizrahi', { username, password: Password }),
  variant('discount', { id, password: Password, num }),
  variant('mercantile', { id, password: Password, num }),
  variant('otsarHahayal', { username, password: Password }),
  variant('max', { username, password: Password }),
  variant('visaCal', { username, password: Password }),
  variant('isracard', { id, card6Digits, password: Password }),
  variant('amex', { id, card6Digits, password: Password }),
  variant('union', { username, password: Password }),
  variant('beinleumi', { username, password: Password }),
  variant('massad', { username, password: Password }),
  variant('yahav', { username, nationalID, password: Password }),
  variant('beyahadBishvilha', { id, password: Password }),
  oneZeroCredentials,
  variant('behatsdaa', { id, password: Password }),
  variant('pagi', { username, password: Password }),
] as const;

/** Discriminated union of all supported credential shapes, keyed by companyId. */
export const Credentials = Type.Union([...CredentialVariants], {
  $id: 'Credentials',
  title: 'Credentials',
  description: 'Company credentials. The required fields depend on companyId.',
});
export type Credentials = Static<typeof Credentials>;
