// services/admin-dashboard/app/components/programAwardsMasterData/award-form.ts
import type { ProgramAward, ProgramAwardInput } from "@/src/shared/api-client";

const INT32_MAX = 2147483647;

export type AwardFormState = {
  name: string;
  category: string;
  tier: string;
  description: string;
  tags: string;
  winnerCount: string;
  color: string;
  iconUrl: string;
  badgeUrl: string;
  order: string;
  isActive: boolean;
};

export type AwardPayloadResult =
  | { ok: true; payload: ProgramAwardInput & { name: string } }
  | { ok: false; error: string };

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const INTEGER = /^-?\d+$/;

export function emptyAwardForm(nextOrder: number): AwardFormState {
  return {
    name: "", category: "", tier: "", description: "", tags: "", winnerCount: "",
    color: "", iconUrl: "", badgeUrl: "", order: String(nextOrder), isActive: true,
  };
}

export function awardToForm(award: ProgramAward): AwardFormState {
  return {
    name: award.name,
    category: award.category ?? "",
    tier: award.tier ?? "",
    description: award.description ?? "",
    tags: award.tags.join(", "),
    winnerCount: award.winnerCount === null ? "" : String(award.winnerCount),
    color: award.color ?? "",
    iconUrl: award.iconUrl ?? "",
    badgeUrl: award.badgeUrl ?? "",
    order: String(award.order),
    isActive: award.isActive,
  };
}

export function nextAwardOrder(awards: ProgramAward[]): number {
  return awards.reduce((max, award) => Math.max(max, award.order), 0) + 1;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Mirrors the API DTO so most mistakes are caught before the round trip. Blank
// optional fields are sent as null so clearing a field in the form clears it.
export function buildAwardPayload(form: AwardFormState): AwardPayloadResult {
  const name = form.name.trim();
  const color = form.color.trim();
  const iconUrl = form.iconUrl.trim();
  const badgeUrl = form.badgeUrl.trim();
  const winnerCount = form.winnerCount.trim();
  const order = form.order.trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 255) return { ok: false, error: "Name must be 255 characters or fewer." };
  if (form.category.trim().length > 100) return { ok: false, error: "Category must be 100 characters or fewer." };
  if (form.tier.trim().length > 50) return { ok: false, error: "Tier must be 50 characters or fewer." };
  if (winnerCount && (!INTEGER.test(winnerCount) || Number(winnerCount) < 0 || Number(winnerCount) > INT32_MAX)) {
    return { ok: false, error: "Winners must be a whole number of 0 or more." };
  }
  if (!INTEGER.test(order) || Math.abs(Number(order)) > INT32_MAX) return { ok: false, error: "Order must be a whole number." };
  if (color && !HEX_COLOR.test(color)) return { ok: false, error: "Color must be a hex value like #1D4ED8." };
  for (const [label, url] of [["Icon URL", iconUrl], ["Badge URL", badgeUrl]] as const) {
    if (url && (!isHttpUrl(url) || url.length > 500)) {
      return { ok: false, error: `${label} must be an http(s) link of 500 characters or fewer.` };
    }
  }

  return {
    ok: true,
    payload: {
      name,
      category: form.category.trim() || null,
      tier: form.tier.trim() || null,
      description: form.description.trim() || null,
      tags: [...new Set(form.tags.split(",").map((tag) => tag.trim()).filter(Boolean))],
      winnerCount: winnerCount ? Number(winnerCount) : null,
      color: color || null,
      iconUrl: iconUrl || null,
      badgeUrl: badgeUrl || null,
      order: Number(order),
      isActive: form.isActive,
    },
  };
}

export function filterAwards(awards: ProgramAward[], query: string): ProgramAward[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return awards;
  return awards.filter((award) =>
    [award.name, award.category, award.tier, award.description]
      .some((field) => field?.toLowerCase().includes(needle)),
  );
}
