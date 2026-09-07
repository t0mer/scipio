import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Credentials } from './credentials.js';
import { ScrapeOptions } from './options.js';

/** A value that may be null (used for bank numbers that can be unparseable). */
const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()]);

/** Scrape error outcomes surfaced by the library (not HTTP errors). */
export const SCRAPE_ERROR_TYPES = [
  'TWO_FACTOR_RETRIEVER_MISSING',
  'INVALID_PASSWORD',
  'CHANGE_PASSWORD',
  'TIMEOUT',
  'ACCOUNT_BLOCKED',
  'GENERIC',
  'GENERAL_ERROR',
] as const;

const Installments = Type.Object(
  {
    number: Type.Integer({ description: 'Current installment number.' }),
    total: Type.Integer({ description: 'Total number of installments.' }),
  },
  { additionalProperties: false, title: 'Installments' },
);

export const Transaction = Type.Object(
  {
    type: Type.Union([Type.Literal('normal'), Type.Literal('installments')]),
    identifier: Type.Optional(
      Type.Union([Type.String(), Type.Number()], { description: 'Asmachta / reference.' }),
    ),
    date: Type.String({ description: 'ISO date string.' }),
    processedDate: Type.String({ description: 'ISO date string.' }),
    originalAmount: Nullable(Type.Number()),
    originalCurrency: Type.String(),
    chargedAmount: Nullable(Type.Number()),
    chargedCurrency: Type.Optional(Type.String()),
    description: Type.String(),
    memo: Type.Optional(Type.String()),
    status: Type.Union([Type.Literal('completed'), Type.Literal('pending')]),
    installments: Type.Optional(Installments),
    category: Type.Optional(Type.String()),
    rawTransaction: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: true, title: 'Transaction' },
);
export type Transaction = Static<typeof Transaction>;

export const Account = Type.Object(
  {
    accountNumber: Type.String(),
    balance: Type.Optional(Nullable(Type.Number())),
    balanceDate: Type.Optional(Type.String()),
    cardFrame: Type.Optional(Nullable(Type.Number())),
    cardType: Type.Optional(
      Type.Union([Type.Literal('bankIssued'), Type.Literal('companyIssued')]),
    ),
    currency: Type.Optional(Type.String()),
    savingsAccount: Type.Optional(Type.Boolean()),
    txns: Type.Array(Transaction),
  },
  { additionalProperties: true, title: 'Account' },
);
export type Account = Static<typeof Account>;

export const FutureDebit = Type.Object(
  {
    amount: Nullable(Type.Number()),
    amountCurrency: Type.String(),
    chargeDate: Type.Optional(Type.String()),
    bankAccountNumber: Type.Optional(Type.String()),
  },
  { additionalProperties: true, title: 'FutureDebit' },
);
export type FutureDebit = Static<typeof FutureDebit>;

/** Mirrors the library's ScraperScrapingResult verbatim. */
export const ScrapeResult = Type.Object(
  {
    success: Type.Boolean(),
    accounts: Type.Optional(Type.Array(Account)),
    futureDebits: Type.Optional(Type.Array(FutureDebit)),
    errorType: Type.Optional(Type.Union(SCRAPE_ERROR_TYPES.map((e) => Type.Literal(e)))),
    errorMessage: Type.Optional(Type.String()),
  },
  { title: 'ScrapeResult', additionalProperties: true },
);
export type ScrapeResult = Static<typeof ScrapeResult>;

/** Request body shared by POST /scrape and POST /jobs. */
export const ScrapeRequest = Type.Object(
  {
    credentials: Credentials,
    options: ScrapeOptions,
  },
  { title: 'ScrapeRequest', additionalProperties: false },
);
export type ScrapeRequest = Static<typeof ScrapeRequest>;
