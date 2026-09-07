import { Prisma } from '@prisma/client';

const CLICK_ID_KEYS = ['fbp', 'fbc', 'ttp', 'ttclid'] as const;
const MAX_CLICK_ID_LENGTH = 256;

export type AdAttributionInput = Partial<Record<(typeof CLICK_ID_KEYS)[number], string>>;

/**
 * Builds the JSON blob written ONCE to participants.ad_attribution at
 * creation (see the field's doc comment in schema/roles.prisma). Returns
 * undefined when nothing usable was captured, so the column stays NULL
 * instead of storing an empty/all-undefined object — callers should spread
 * this straight into a Prisma `data` object with `?? undefined`.
 *
 * Re-validates length defensively (the DTO already caps it) since this is
 * also the boundary that decides what gets persisted.
 */
export function buildAdAttributionJson(input?: AdAttributionInput): Prisma.InputJsonValue | undefined {
  if (!input) return undefined;

  const clean: Record<string, string> = {};
  for (const key of CLICK_ID_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.length > 0 && value.length <= MAX_CLICK_ID_LENGTH) {
      clean[key] = value;
    }
  }

  if (Object.keys(clean).length === 0) return undefined;
  return { ...clean, capturedAt: new Date().toISOString() };
}

/**
 * Reads participants.ad_attribution back into the flat click-id shape
 * MetaCapiService.emitServerEvent expects. Defensive about the column's
 * actual shape (Json, not a typed column) even though buildAdAttributionJson
 * is the only writer.
 */
export function parseAdAttribution(value: Prisma.JsonValue | null | undefined): AdAttributionInput | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  const result: AdAttributionInput = {};
  for (const key of CLICK_ID_KEYS) {
    const raw = record[key];
    if (typeof raw === 'string' && raw.length > 0) {
      result[key] = raw;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
