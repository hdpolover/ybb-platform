// services/admin-dashboard/lib/ff-results-notice.test.ts
import { describe, it, expect } from "vitest";
import { getFfResultsHiddenNotice } from "./ff-results-notice.ts";

const NOW = new Date("2026-11-09T00:00:00Z");

describe("getFfResultsHiddenNotice", () => {
  it("returns null when no application has a result", () => {
    expect(getFfResultsHiddenNotice({ hasDecisions: false, announcedAt: null, now: NOW })).toBeNull();
    expect(getFfResultsHiddenNotice({ hasDecisions: false, announcedAt: "2030-01-01T00:00:00Z", now: NOW })).toBeNull();
  });

  it("says 'not set' when results exist but the program has no announcement date", () => {
    expect(getFfResultsHiddenNotice({ hasDecisions: true, announcedAt: null, now: NOW })).toBe(
      "FF results are hidden from applicants until the announcement date (not set). Set it in program settings.",
    );
  });

  it("treats an unparseable date as not set", () => {
    expect(getFfResultsHiddenNotice({ hasDecisions: true, announcedAt: "garbage", now: NOW })).toContain("(not set)");
  });

  it("shows the date in WIB when the announcement is in the future", () => {
    const notice = getFfResultsHiddenNotice({ hasDecisions: true, announcedAt: "2026-12-01T03:30:00Z", now: NOW });
    expect(notice).toContain("1 Dec 2026");
    expect(notice).toContain("10:30"); // 03:30 UTC = 10:30 WIB
    expect(notice).toContain("WIB");
  });

  it("returns null once the announcement date has passed", () => {
    expect(getFfResultsHiddenNotice({ hasDecisions: true, announcedAt: "2026-11-01T00:00:00Z", now: NOW })).toBeNull();
  });

  it("returns null at the exact announcement instant", () => {
    expect(getFfResultsHiddenNotice({ hasDecisions: true, announcedAt: NOW.toISOString(), now: NOW })).toBeNull();
  });
});
