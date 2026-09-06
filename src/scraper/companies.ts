import { CompanyTypes, SCRAPERS } from 'israeli-bank-scrapers-core';
import type { Company, CompaniesResponse } from '../schemas/companies.js';
import { OPT_IN_FEATURES } from '../schemas/options.js';

/** Companies that require an interactive two-factor (OTP) login flow. */
const TWO_FACTOR_COMPANIES = new Set<string>([CompanyTypes.oneZero]);

/**
 * Builds the supported-companies metadata at runtime from the library's exported
 * `SCRAPERS` map — never hardcoded — so it always reflects the installed
 * library version.
 */
export function listCompanies(): Company[] {
  return Object.entries(SCRAPERS)
    .map(([companyId, meta]) => ({
      companyId,
      name: meta.name,
      loginFields: [...meta.loginFields],
      requiresTwoFactor: TWO_FACTOR_COMPANIES.has(companyId),
    }))
    .sort((a, b) => a.companyId.localeCompare(b.companyId));
}

/** Full companies response including the accepted opt-in features. */
export function companiesResponse(): CompaniesResponse {
  return {
    companies: listCompanies(),
    optInFeatures: [...OPT_IN_FEATURES],
  };
}

export function companyRequiresTwoFactor(companyId: string): boolean {
  return TWO_FACTOR_COMPANIES.has(companyId);
}
