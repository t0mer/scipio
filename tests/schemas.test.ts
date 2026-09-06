import { describe, it, expect } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import { CompanyTypes, SCRAPERS } from 'israeli-bank-scrapers-core';
import type { TObject, TLiteral } from '@sinclair/typebox';
import { CredentialVariants, Credentials } from '../src/schemas/credentials.js';
import { OPT_IN_FEATURES, ScrapeOptions } from '../src/schemas/options.js';
import { SCRAPE_ERROR_TYPES } from '../src/schemas/scrape.js';
import { PROGRESS_TYPES } from '../src/schemas/jobs.js';

/** Extracts a variant's declared field names (minus the discriminator). */
function fieldsOf(variant: TObject): string[] {
  return Object.keys(variant.properties).filter((k) => k !== 'companyId');
}

function companyIdOf(variant: TObject): string {
  return (variant.properties.companyId as TLiteral).const as string;
}

describe('credential schemas', () => {
  it('covers exactly the companies the library exposes', () => {
    const schemaIds = CredentialVariants.map((v) => companyIdOf(v as TObject)).sort();
    const libraryIds = Object.values(CompanyTypes).sort();
    expect(schemaIds).toEqual(libraryIds);
  });

  it("matches each company's login fields to the library's SCRAPERS metadata", () => {
    for (const variant of CredentialVariants) {
      const companyId = companyIdOf(variant as TObject);
      // oneZero is the documented exception: its interactive OTP flow is handled
      // server-side (otpCodeRetriever) and its phoneNumber lives in the /2fa
      // endpoints, so the scrape credential exposes only email + password
      // (+ optional otpLongTermToken). Asserted separately below.
      if (companyId === 'oneZero') continue;
      const libraryFields = [
        ...(SCRAPERS as Record<string, { loginFields: string[] }>)[companyId]!.loginFields,
      ].sort();
      const schemaFields = fieldsOf(variant as TObject).sort();
      expect(schemaFields, `login fields for ${companyId}`).toEqual(libraryFields);
    }
  });

  it('exposes oneZero as email + password with an optional long-term token', () => {
    const oneZero = CredentialVariants.find(
      (v) => companyIdOf(v as TObject) === 'oneZero',
    ) as TObject;
    expect(fieldsOf(oneZero).sort()).toEqual([
      'email',
      'otpLongTermToken',
      'password',
      'phoneNumber',
    ]);
    expect(Value.Check(Credentials, { companyId: 'oneZero', email: 'a@b.co', password: 'p' })).toBe(
      true,
    );
    expect(
      Value.Check(Credentials, {
        companyId: 'oneZero',
        email: 'a@b.co',
        password: 'p',
        otpLongTermToken: 'tok',
      }),
    ).toBe(true);
  });

  it('accepts a valid credential and rejects a mismatched shape', () => {
    expect(Value.Check(Credentials, { companyId: 'leumi', username: 'u', password: 'p' })).toBe(
      true,
    );
    // hapoalim needs userCode, not username
    expect(Value.Check(Credentials, { companyId: 'hapoalim', username: 'u', password: 'p' })).toBe(
      false,
    );
    // unknown company
    expect(Value.Check(Credentials, { companyId: 'nope', username: 'u', password: 'p' })).toBe(
      false,
    );
  });
});

describe('options schema', () => {
  it('requires startDate and validates ISO shapes', () => {
    expect(Value.Check(ScrapeOptions, { startDate: '2024-01-01' })).toBe(true);
    expect(Value.Check(ScrapeOptions, { startDate: '2024-01-01T00:00:00Z' })).toBe(true);
    expect(Value.Check(ScrapeOptions, {})).toBe(false);
    expect(Value.Check(ScrapeOptions, { startDate: 'not-a-date' })).toBe(false);
  });

  it('rejects unknown opt-in features', () => {
    expect(Value.Check(ScrapeOptions, { startDate: '2024-01-01', optInFeatures: ['bad'] })).toBe(
      false,
    );
    expect(
      Value.Check(ScrapeOptions, { startDate: '2024-01-01', optInFeatures: [...OPT_IN_FEATURES] }),
    ).toBe(true);
  });
});

// Compile-time guard: our OPT_IN_FEATURES must be assignable to the library union
// and vice versa. Derived from the exported ScraperOptions type (OptInFeatures
// itself is not re-exported). If the library changes its opt-in features, one of
// these assignments stops compiling.
import type { ScraperOptions } from 'israeli-bank-scrapers-core';
type LibOptIn = NonNullable<ScraperOptions['optInFeatures']>[number];
describe('library enum parity (compile + runtime)', () => {
  it('opt-in features match the library union', () => {
    const _forward: LibOptIn = OPT_IN_FEATURES[0];
    const _reverse: (typeof OPT_IN_FEATURES)[number] =
      'isracard-amex:skipAdditionalTransactionInformation' satisfies LibOptIn;
    expect(_forward).toBeTruthy();
    expect(_reverse).toBeTruthy();
    expect(OPT_IN_FEATURES.length).toBe(4);
  });

  it('error and progress enums are non-empty and stable', () => {
    expect(SCRAPE_ERROR_TYPES).toContain('INVALID_PASSWORD');
    expect(SCRAPE_ERROR_TYPES).toContain('TIMEOUT');
    expect(PROGRESS_TYPES).toContain('LOGGING_IN');
    expect(PROGRESS_TYPES).toContain('TERMINATING');
  });
});
