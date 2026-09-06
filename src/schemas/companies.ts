import { Type, type Static } from '@sinclair/typebox';
import { OPT_IN_FEATURES } from './options.js';

/** One supported company's metadata, derived at runtime from the library. */
export const Company = Type.Object(
  {
    companyId: Type.String({ description: 'Company identifier used in requests.' }),
    name: Type.String({ description: 'Human-readable company name.' }),
    loginFields: Type.Array(Type.String(), {
      description: 'Credential field names required by this company.',
    }),
    requiresTwoFactor: Type.Boolean({
      description: 'Whether this company requires an interactive 2FA/OTP flow.',
    }),
  },
  { additionalProperties: false, title: 'Company' },
);
export type Company = Static<typeof Company>;

export const CompaniesResponse = Type.Object(
  {
    companies: Type.Array(Company),
    optInFeatures: Type.Array(Type.Union(OPT_IN_FEATURES.map((f) => Type.Literal(f))), {
      description: 'Opt-in features accepted in scrape options.',
    }),
  },
  { title: 'CompaniesResponse', additionalProperties: false },
);
export type CompaniesResponse = Static<typeof CompaniesResponse>;
