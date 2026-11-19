// services/admin-dashboard/app/components/programAwardsMasterData/award-form.test.ts
import { describe, expect, it } from "vitest";
import type { ProgramAward } from "@/src/shared/api-client";
import { awardToForm, buildAwardPayload, emptyAwardForm, filterAwards, nextAwardOrder } from "./award-form";

const award = (overrides: Partial<ProgramAward>): ProgramAward => ({
  id: "a1", programId: "p1", name: "Best Delegate", description: null, category: null, tier: null,
  tags: [], winnerCount: null, color: null, iconUrl: null, badgeUrl: null, isActive: true, order: 1,
  createdAt: "", updatedAt: "", ...overrides,
});

describe("buildAwardPayload", () => {
  it("trims values, splits tags and sends blanks as null so edits can clear fields", () => {
    const result = buildAwardPayload({
      ...emptyAwardForm(3),
      name: "  Best Speaker ", tags: "Public Speaking, , Leadership ", winnerCount: "2", color: "#1d4ed8",
    });
    expect(result).toEqual({
      ok: true,
      payload: {
        name: "Best Speaker", category: null, tier: null, description: null,
        tags: ["Public Speaking", "Leadership"], winnerCount: 2, color: "#1d4ed8",
        iconUrl: null, badgeUrl: null, order: 3, isActive: true,
      },
    });
  });

  it.each([
    ["empty name", { name: "  " }, "Name is required."],
    ["bad color", { name: "A", color: "blue" }, "Color must be a hex value like #1D4ED8."],
    ["non-http url", { name: "A", iconUrl: "javascript:alert(1)" }, "Icon URL must be an http(s) link of 500 characters or fewer."],
    ["negative winners", { name: "A", winnerCount: "-1" }, "Winners must be a whole number of 0 or more."],
    ["fractional order", { name: "A", order: "1.5" }, "Order must be a whole number."],
  ])("rejects %s", (_label, overrides, error) => {
    expect(buildAwardPayload({ ...emptyAwardForm(1), ...overrides })).toEqual({ ok: false, error });
  });

  it("round-trips an existing award through the form", () => {
    const existing = award({ name: "Gold", tags: ["A", "B"], winnerCount: 0, color: "#FFAA00", order: 4, isActive: false });
    const result = buildAwardPayload(awardToForm(existing));
    expect(result.ok && result.payload).toMatchObject({ name: "Gold", tags: ["A", "B"], winnerCount: 0, color: "#FFAA00", order: 4, isActive: false });
  });
});

describe("filterAwards", () => {
  const awards = [
    award({ id: "1", name: "Best Delegate", category: "Delegate" }),
    award({ id: "2", name: "Best Paper", tier: "gold" }),
    award({ id: "3", name: "Rising Star", description: "For a first-time delegate" }),
  ];

  it("matches name, category, tier and description case-insensitively", () => {
    expect(filterAwards(awards, "DELEGATE").map((a) => a.id)).toEqual(["1", "3"]);
    expect(filterAwards(awards, "gold").map((a) => a.id)).toEqual(["2"]);
    expect(filterAwards(awards, "  ")).toHaveLength(3);
  });
});

describe("nextAwardOrder", () => {
  it("is one past the highest order, or 1 when empty", () => {
    expect(nextAwardOrder([])).toBe(1);
    expect(nextAwardOrder([award({ order: 2 }), award({ order: 7 })])).toBe(8);
  });
});
