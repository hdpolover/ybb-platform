// services/admin-dashboard/app/platform/audit/audit-page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { DiffView } from "./_components/DiffView";
import { AdminActivityTab } from "./_components/AdminActivityTab";
import { AdminLoginsTab } from "./_components/AdminLoginsTab";

const listAuditLogs = vi.fn();
const listEntityAuditHistory = vi.fn();
const listAdminSecurityEvents = vi.fn();
const exportAuditLogs = vi.fn();

vi.mock("@/src/shared/api-client", () => ({
  listAuditLogs: (...a: unknown[]) => listAuditLogs(...a),
  listEntityAuditHistory: (...a: unknown[]) => listEntityAuditHistory(...a),
  listAdminSecurityEvents: (...a: unknown[]) => listAdminSecurityEvents(...a),
  exportAuditLogs: (...a: unknown[]) => exportAuditLogs(...a),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const ADMINS = [
  { id: "admin-1", name: "Ada Admin", email: "ada@ybb.test" },
  { id: "admin-2", name: "Bo Boss", email: "bo@ybb.test" },
];

const ENTRY = {
  id: "log-1",
  createdAt: "2026-11-18T03:00:00.000Z",
  action: "update",
  entityType: "ParticipantApplication",
  entityId: "11111111-2222-3333-4444-555555555555",
  changedFields: ["status"],
  beforeState: { status: "draft", note: "<img src=x onerror=alert(1)>", same: 1 },
  afterState: { status: "submitted", note: "<img src=x onerror=alert(1)>", same: 1 },
  actorType: "admin",
  actorId: "admin-1",
  source: "http",
  endpoint: "PATCH /v1/admin/applications/:id/status",
  httpMethod: "PATCH",
  event: null,
  ipAddress: "10.0.0.1",
  riskLevel: "low",
  reason: null,
  status: "SUCCESS",
  errorMessage: null,
};

const page = (data: unknown[]) => ({ data, meta: { total: data.length, page: 1, limit: 20, totalPages: 1 } });

describe("DiffView", () => {
  it("highlights changed fields, collapses unchanged ones and pretty-prints JSON", () => {
    const { container } = render(<DiffView before={ENTRY.beforeState} after={ENTRY.afterState} />);

    const changed = screen.getAllByTestId("diff-changed");
    expect(changed).toHaveLength(1);
    expect(within(changed[0]).getByText("status")).toBeTruthy();
    expect(within(changed[0]).getByText('"draft"')).toBeTruthy();
    expect(within(changed[0]).getByText('"submitted"')).toBeTruthy();
    expect(screen.getByText("2 unchanged fields")).toBeTruthy();
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(false);
  });

  it("renders log content as text, never as markup", () => {
    const { container } = render(<DiffView before={ENTRY.beforeState} after={ENTRY.afterState} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("shows an empty state when no snapshot was captured", () => {
    render(<DiffView before={null} after={null} />);
    expect(screen.getByText("No state captured")).toBeTruthy();
  });
});

describe("AdminActivityTab", () => {
  beforeEach(() => {
    listAuditLogs.mockReset().mockResolvedValue(page([ENTRY]));
    listEntityAuditHistory.mockReset().mockResolvedValue(page([ENTRY]));
    exportAuditLogs.mockReset().mockResolvedValue(undefined);
  });

  it("loads admin actors for the last 7 days by default and names the admin", async () => {
    render(<AdminActivityTab admins={ADMINS} />);

    expect(await screen.findByText("Ada Admin (ada@ybb.test)")).toBeTruthy();
    const [filters, pageNo, limit] = listAuditLogs.mock.calls[0];
    expect(filters).toMatchObject({ adminId: "", entityType: "", action: "", search: "" });
    expect(filters.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filters.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect([pageNo, limit]).toEqual([1, 20]);
  });

  it("refetches from page 1 with the chosen admin and action", async () => {
    render(<AdminActivityTab admins={ADMINS} />);
    await screen.findByText("Ada Admin (ada@ybb.test)");

    fireEvent.change(screen.getByLabelText("Admin"), { target: { value: "admin-2" } });
    await waitFor(() => expect(listAuditLogs.mock.calls.at(-1)![0]).toMatchObject({ adminId: "admin-2" }));
    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "delete" } });
    await waitFor(() => expect(listAuditLogs.mock.calls.at(-1)![0]).toMatchObject({ adminId: "admin-2", action: "delete" }));
    expect(listAuditLogs.mock.calls.at(-1)![1]).toBe(1);
  });

  it("opens the drawer on row click and loads the record history", async () => {
    render(<AdminActivityTab admins={ADMINS} />);
    fireEvent.click(await screen.findByLabelText("View change details"));

    expect(await screen.findByText("Changes")).toBeTruthy();
    fireEvent.click(screen.getByText("All changes to this record"));
    await waitFor(() =>
      expect(listEntityAuditHistory).toHaveBeenCalledWith("ParticipantApplication", ENTRY.entityId, 1, 50),
    );
  });

  it("exports with the current filters", async () => {
    render(<AdminActivityTab admins={ADMINS} />);
    await screen.findByText("Ada Admin (ada@ybb.test)");
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(exportAuditLogs).toHaveBeenCalledTimes(1));
    expect(exportAuditLogs.mock.calls[0][0]).toMatchObject({ adminId: "" });
  });

  it("shows an empty state, not a blank table, when nothing matches", async () => {
    listAuditLogs.mockResolvedValue(page([]));
    render(<AdminActivityTab admins={ADMINS} />);
    expect(await screen.findByText("No admin activity found")).toBeTruthy();
  });
});

describe("AdminLoginsTab", () => {
  const EVENT = {
    id: "ev-1",
    createdAt: "2026-11-18T03:00:00.000Z",
    eventType: "LOGIN_FAILED",
    eventStatus: "FAILURE",
    ipAddress: "203.0.113.9",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    adminId: "admin-1",
    adminName: "Ada Admin",
    adminEmail: "ada@ybb.test",
  };

  beforeEach(() => {
    listAdminSecurityEvents.mockReset().mockResolvedValue(page([EVENT]));
  });

  it("renders event, status, IP and a short user agent", async () => {
    render(<AdminLoginsTab admins={ADMINS} />);

    expect(await screen.findByText("Login failed")).toBeTruthy();
    expect(screen.getByText("failure")).toBeTruthy();
    expect(screen.getByText("203.0.113.9")).toBeTruthy();
    expect(screen.getByText("Chrome 120 on macOS")).toBeTruthy();
    expect(screen.getByText("ada@ybb.test")).toBeTruthy();
  });

  it("filters by admin and restarts at page 1", async () => {
    render(<AdminLoginsTab admins={ADMINS} />);
    await screen.findByText("Login failed");

    fireEvent.change(screen.getByLabelText("Admin"), { target: { value: "admin-2" } });
    await waitFor(() => expect(listAdminSecurityEvents.mock.calls.at(-1)![0]).toMatchObject({ adminId: "admin-2" }));
    expect(listAdminSecurityEvents.mock.calls.at(-1)![1]).toBe(1);
  });

  it("shows an empty state when there are no events", async () => {
    listAdminSecurityEvents.mockResolvedValue(page([]));
    render(<AdminLoginsTab admins={ADMINS} />);
    expect(await screen.findByText("No admin logins found")).toBeTruthy();
  });
});
