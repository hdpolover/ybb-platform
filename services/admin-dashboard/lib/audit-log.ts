// services/admin-dashboard/lib/audit-log.ts
// Pure helpers for the platform audit page: query building, before/after diffing, short labels.
import { BUSINESS_TIMEZONE } from "@/lib/datetime";

export const AUDIT_ACTIONS = ["create", "update", "delete", "status_change", "bulk_update"] as const;
export const AUDIT_PAGE_SIZE = 20;
const DEFAULT_RANGE_DAYS = 7;
const SHORT_ID_CHARS = 8;
const SHORT_UA_CHARS = 48;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AuditActivityFilters = {
  adminId: string;
  entityType: string;
  action: string;
  search: string;
  dateFrom: string;
  dateTo: string;
};

export type SecurityEventFilters = Pick<AuditActivityFilters, "adminId" | "dateFrom" | "dateTo">;

/** YYYY-MM-DD of an instant on the WIB calendar (the API reads bare dates as WIB days). */
function wibDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE }).format(date);
}

/** Last 7 WIB calendar days, today included. */
export function defaultDateRange(now: Date = new Date()): { dateFrom: string; dateTo: string } {
  return { dateFrom: wibDay(new Date(now.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS)), dateTo: wibDay(now) };
}

export function defaultActivityFilters(now?: Date): AuditActivityFilters {
  return { adminId: "", entityType: "", action: "", search: "", ...defaultDateRange(now) };
}

/** Query for /admin/audit-logs and its export: always admin actors, blank filters omitted. Paging only when given. */
export function buildActivityQuery(
  filters: AuditActivityFilters,
  paging?: { page: number; limit: number },
): URLSearchParams {
  const q = new URLSearchParams({ actorType: "admin" });
  if (paging) {
    q.set("page", String(paging.page));
    q.set("limit", String(paging.limit));
  }
  const entries: Array<[string, string]> = [
    ["actorId", filters.adminId],
    ["entityType", filters.entityType.trim()],
    ["action", filters.action],
    ["search", filters.search.trim()],
    ["dateFrom", filters.dateFrom],
    ["dateTo", filters.dateTo],
  ];
  for (const [key, value] of entries) if (value) q.set(key, value);
  return q;
}

export function buildSecurityEventsQuery(
  filters: SecurityEventFilters,
  paging: { page: number; limit: number },
): URLSearchParams {
  const q = new URLSearchParams({ page: String(paging.page), limit: String(paging.limit) });
  if (filters.adminId) q.set("adminId", filters.adminId);
  if (filters.dateFrom) q.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) q.set("dateTo", filters.dateTo);
  return q;
}

export type AdminOption = { id: string; name: string; email: string };

/** "Name (email)" for a known admin, else a short id so unknown actors are still distinguishable. */
export function adminLabel(admins: ReadonlyMap<string, AdminOption>, id: string | null): string {
  if (!id) return "—";
  const a = admins.get(id);
  return a ? `${a.name} (${a.email})` : `Unknown admin ${shortId(id)}`;
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, SHORT_ID_CHARS) : "—";
}

/** "Chrome 120 on macOS"-style label; falls back to a truncated raw string. */
export function shortUserAgent(ua: string | null | undefined): string {
  if (!ua) return "—";
  // Order matters: Edge and Chrome UAs both contain "Chrome/", Chrome's also contains "Safari".
  const known: Array<[string, RegExp]> = [
    ["Edge", /Edg\/(\d+)/], ["Firefox", /Firefox\/(\d+)/], ["Chrome", /Chrome\/(\d+)/], ["Safari", /Version\/(\d+).*Safari/],
  ];
  const hit = known.map(([name, re]) => [name, re.exec(ua)] as const).find(([, m]) => m);
  const browser = hit ? `${hit[0]} ${hit[1]![1]}` : null;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  if (browser && os) return `${browser} on ${os}`;
  return ua.length > SHORT_UA_CHARS ? `${ua.slice(0, SHORT_UA_CHARS - 1)}…` : ua;
}

// ─── Diff ────────────────────────────────────────────────────────────────────

export type DiffRow = { key: string; before: unknown; after: unknown; changed: boolean };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Key-order independent JSON; two values are "equal" when their canonical strings match. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isRecord(v)) {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "undefined";
}

/**
 * Top-level field diff of two state snapshots. Changed rows first, then unchanged,
 * each alphabetical. A non-object snapshot (null on create/delete, or a scalar)
 * is treated as having no fields.
 */
export function diffStates(before: unknown, after: unknown): DiffRow[] {
  const isOpaque = (v: unknown) => v !== null && v !== undefined && !isRecord(v);
  if (isOpaque(before) || isOpaque(after)) {
    return [{ key: "(value)", before, after, changed: canonical(before) !== canonical(after) }];
  }
  const b = isRecord(before) ? before : {};
  const a = isRecord(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const rows = keys.map((key) => ({
    key,
    before: b[key],
    after: a[key],
    changed: canonical(b[key]) !== canonical(a[key]),
  }));
  return rows.sort((x, y) => Number(y.changed) - Number(x.changed) || x.key.localeCompare(y.key));
}

/** Pretty JSON for display; undefined (key absent on that side) reads as "—". Always text, never HTML. */
export function formatJson(value: unknown): string {
  if (value === undefined) return "—";
  return JSON.stringify(value, null, 2) ?? String(value);
}
