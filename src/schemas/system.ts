import { Type, type Static } from '@sinclair/typebox';

export const HealthResponse = Type.Object(
  {
    status: Type.Literal('ok'),
    version: Type.String(),
  },
  { title: 'HealthResponse', additionalProperties: false },
);
export type HealthResponse = Static<typeof HealthResponse>;

export const ReadyResponse = Type.Object(
  {
    status: Type.Union([Type.Literal('ok'), Type.Literal('unavailable')]),
    chromium: Type.Boolean({ description: 'Whether the Chromium executable is present.' }),
  },
  { title: 'ReadyResponse', additionalProperties: false },
);
export type ReadyResponse = Static<typeof ReadyResponse>;

export const VersionResponse = Type.Object(
  {
    version: Type.String(),
    libraryVersion: Type.String(),
    commit: Type.String(),
  },
  { title: 'VersionResponse', additionalProperties: false },
);
export type VersionResponse = Static<typeof VersionResponse>;
