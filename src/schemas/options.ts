import { Type, type Static } from '@sinclair/typebox';

/**
 * Opt-in features exposed by the API. This list mirrors the library's
 * `OptInFeatures` union; a type-level test fails the build if the two drift.
 */
export const OPT_IN_FEATURES = [
  'isracard-amex:skipAdditionalTransactionInformation',
  'mizrahi:pendingIfNoIdentifier',
  'mizrahi:pendingIfHasGenericDescription',
  'mizrahi:pendingIfTodayTransaction',
] as const;

// Accepts an ISO 8601 date (YYYY-MM-DD) or date-time. Kept as a pattern to avoid
// depending on ajv-formats being registered in the Fastify ajv instance.
const ISO_DATE_PATTERN =
  '^\\d{4}-\\d{2}-\\d{2}([T ]\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?(Z|[+-]\\d{2}:?\\d{2})?)?$';

/**
 * Scrape options mapped 1:1 to the library's `ScraperOptions` (minus the
 * server-controlled browser fields). `companyId` is carried by the credentials
 * object, not here.
 */
export const ScrapeOptions = Type.Object(
  {
    startDate: Type.String({
      pattern: ISO_DATE_PATTERN,
      description: 'ISO 8601 date/date-time to fetch transactions from.',
    }),
    combineInstallments: Type.Optional(
      Type.Boolean({ description: 'Combine installment transactions into the first one.' }),
    ),
    futureMonthsToScrape: Type.Optional(
      Type.Integer({ minimum: 0, description: 'Scrape transactions N months into the future.' }),
    ),
    additionalTransactionInformation: Type.Optional(
      Type.Boolean({ description: 'Fetch extra info (e.g. category) per transaction. Slower.' }),
    ),
    includeRawTransaction: Type.Optional(
      Type.Boolean({ description: 'Include the raw source transaction object (debug).' }),
    ),
    verbose: Type.Optional(Type.Boolean({ description: 'Include extra debug info in output.' })),
    timeout: Type.Optional(
      Type.Integer({ minimum: 0, description: 'Navigation timeout in ms (0 disables).' }),
    ),
    defaultTimeout: Type.Optional(
      Type.Integer({ minimum: 0, description: "Puppeteer's default timeout in ms." }),
    ),
    navigationRetryCount: Type.Optional(
      Type.Integer({ minimum: 0, description: 'Times to retry navigation on failure.' }),
    ),
    viewportSize: Type.Optional(
      Type.Object(
        {
          width: Type.Integer({ minimum: 1 }),
          height: Type.Integer({ minimum: 1 }),
        },
        { additionalProperties: false, description: 'Browser viewport size.' },
      ),
    ),
    outputData: Type.Optional(
      Type.Object(
        {
          enableTransactionsFilterByDate: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false, description: 'Output data manipulation options.' },
      ),
    ),
    optInFeatures: Type.Optional(
      Type.Array(Type.Union(OPT_IN_FEATURES.map((f) => Type.Literal(f))), {
        description: 'Opt-in scraper features.',
      }),
    ),
  },
  { additionalProperties: false, $id: 'ScrapeOptions', title: 'ScrapeOptions' },
);
export type ScrapeOptions = Static<typeof ScrapeOptions>;
