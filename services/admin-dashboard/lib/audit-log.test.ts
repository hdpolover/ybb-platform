// services/admin-dashboard/lib/audit-log.test.ts
import { describe, it, expect } from "vitest";
import {
  buildActivityQuery,
  buildSecurityEventsQuery,
  defaultActivityFilters,
  defaultDateRange,
  diffStates,
  formatJson,
  shortUserAgent,
  shortId,
  adminLabel,
} from "./audit-log";

const blank = { adminId: "", entityType: "", action: "", search: "", dateFrom: "", dateTo: "" };

describe("buildActivityQuery", () => {
  it("always pins actorType=admin and omits blank filters", () => {
    expect(buildActivityQuery(blank, { page: 1, limit: 20 }).toString()).toBe("actorType=admin&page=1&limit=20");
  });

  it("maps every filter to the API's parameter names, trimming text", () => {
    const q = buildActivityQuery(
      { adminId: "a-1", entityType: " Admin ", action: "update", search: " /admins ", dateFrom: "2026-11-01", dateTo: "2026-11-07" },
      { page: 3, limit: 20 },
    );
    expect(Object.fromEntries(q)).toEqual({
      actorType: "admin", page: "3", limit: "20", actorId: "a-1", entityType: "Admin",
      action: "update", search: "/admins", dateFrom: "2026-11-01", dateTo: "2026-11-07",
    });
  });

  it("leaves paging out for the export", () => {
    const q = buildActivityQuery({ ...blank, action: "delete" });
    expect(q.has("page")).toBe(false);
    expect(q.has("limit")).toBe(false);
    expect(q.get("action")).toBe("delete");
  });
});

describe("buildSecurityEventsQuery", () => {
  it("sends adminId and the date range only when set", () => {
    expect(buildSecurityEventsQuery({ adminId: "", dateFrom: "", dateTo: "" }, { page: 2, limit: 20 }).toString()).toBe("page=2&limit=20");
    expect(
      Object.fromEntries(buildSecurityEventsQuery({ adminId: "a-1", dateFrom: "2026-11-01", dateTo: "2026-11-02" }, { page: 1, limit: 20 })),
    ).toEqual({ page: "1", limit: "20", adminId: "a-1", dateFrom: "2026-11-01", dateTo: "2026-11-02" });
  });
});

describe("defaultDateRange", () => {
  it("covers the last 7 WIB days, today included", () => {
    // 2026-11-19 20:00 UTC is already 2026-11-20 03:00 in WIB.
    expect(defaultDateRange(new Date("2026-11-19T20:00:00Z"))).toEqual({ dateFrom: "2026-11-14", dateTo: "2026-11-20" });
  });

  it("starts the activity filters on that range with admin/entity/action/search empty", () => {
    expect(defaultActivityFilters(new Date("2026-11-19T05:00:00Z"))).toEqual({
      adminId: "", entityType: "", action: "", search: "", dateFrom: "2026-11-13", dateTo: "2026-11-19",
    });
  });
});

describe("diffStates", () => {
  it("flags changed fields first and ignores key order of nested objects", () => {
    const rows = diffStates(
      { status: "draft", name: "A", meta: { a: 1, b: 2 } },
      { status: "submitted", name: "A", meta: { b: 2, a: 1 } },
    );
    expect(rows.map((r) => [r.key, r.changed])).toEqual([["status", true], ["meta", false], ["name", false]]);
  });

  it("treats a missing side (create/delete) as every field changed", () => {
    expect(diffStates(null, { id: 1, ok: true }).every((r) => r.changed)).toBe(true);
    expect(diffStates({ id: 1 }, null)).toEqual([{ key: "id", before: 1, after: undefined, changed: true }]);
  });

  it("returns nothing when neither side has a snapshot", () => {
    expect(diffStates(null, undefined)).toEqual([]);
  });

  it("falls back to a single (value) row for non-object snapshots", () => {
    expect(diffStates("a", "b")).toEqual([{ key: "(value)", before: "a", after: "b", changed: true }]);
  });

  it("detects array and null changes", () => {
    const rows = diffStates({ tags: ["a"], x: null }, { tags: ["a", "b"], x: null });
    expect(rows.find((r) => r.key === "tags")?.changed).toBe(true);
    expect(rows.find((r) => r.key === "x")?.changed).toBe(false);
  });
});

describe("formatJson / labels", () => {
  it("pretty-prints and shows a dash for an absent key", () => {
    expect(formatJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(formatJson(undefined)).toBe("—");
  });

  it("labels known admins and tags unknown ones with a short id", () => {
    const admins = new Map([["a-1", { id: "a-1", name: "Ada", email: "ada@x.com" }]]);
    expect(adminLabel(admins, "a-1")).toBe("Ada (ada@x.com)");
    expect(adminLabel(admins, "1234567890")).toBe("Unknown admin 12345678");
    expect(adminLabel(admins, null)).toBe("—");
    expect(shortId("abcdef0123456789")).toBe("abcdef01");
  });
});

describe("shortUserAgent", () => {
  it.each([
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Chrome 120 on macOS"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0", "Edge 119 on Windows"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", "Safari 17 on iOS"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0", "Firefox 121 on Linux"],
  ])("summarises %s", (ua, expected) => {
    expect(shortUserAgent(ua)).toBe(expected);
  });

  it("truncates unknown agents and handles empty", () => {
    expect(shortUserAgent("curl/8.4.0")).toBe("curl/8.4.0");
    expect(shortUserAgent("x".repeat(100))).toHaveLength(48);
    expect(shortUserAgent(null)).toBe("—");
  });
});
