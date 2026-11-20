// services/admin-dashboard/app/platform/deletion-requests/deletion-requests-page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DeletionRequestsPage from "./page";

const getDeletionInsights = vi.fn();
vi.mock("@/src/shared/api-client", () => ({
  getDeletionInsights: (...a: unknown[]) => getDeletionInsights(...a),
}));
// jsdom has no layout, so ResponsiveContainer renders nothing useful; the chart is not under test.
vi.mock("recharts", () => {
  const Stub = () => null;
  return { Bar: Stub, BarChart: Stub, CartesianGrid: Stub, ResponsiveContainer: Stub, Tooltip: Stub, XAxis: Stub, YAxis: Stub };
});

const row = (over: Record<string, unknown>) => ({
  id: "r1",
  status: "approved",
  user: { name: "Jane Doe", email: "jane@example.com" },
  brand: "YBB",
  reasonCategory: "cost",
  reason: "short note",
  createdAt: "2026-11-01T00:00:00.000Z",
  scheduledDeletionDate: "2026-12-01T00:00:00.000Z",
  actualDeletionDate: null,
  ...over,
});

const insights = (items: unknown[]) => ({
  totals: { all: 610, last30Days: 42, pendingPurge: 7, completed: 500, cancelled: 61, cancellationRate: 0.1 },
  monthly: [{ month: "2026-11", count: 42 }],
  byReason: [{ category: "not_given", count: 600 }, { category: "too_many_emails", count: 10 }],
  byBrand: [{ brandId: "b1", brand: "YBB", count: 610 }],
  requests: { items, page: 1, limit: 20, total: items.length, lastPage: 1 },
});

describe("DeletionRequestsPage", () => {
  beforeEach(() => {
    getDeletionInsights.mockReset();
  });

  it("renders the KPIs and breakdowns", async () => {
    getDeletionInsights.mockResolvedValue(insights([row({})]));
    render(<DeletionRequestsPage />);

    expect(await screen.findByText("610", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("42", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("Waiting for purge", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("10.0%")).toBeTruthy();
    expect(screen.getByText("Not given")).toBeTruthy();
    expect(screen.getByText("Too many emails")).toBeTruthy();
  });

  it("shows identity for approved rows and 'Deleted user' for purged ones", async () => {
    getDeletionInsights.mockResolvedValue(
      insights([
        row({}),
        row({ id: "r2", status: "completed", user: null, reasonCategory: "privacy_concern", reason: "x".repeat(120), actualDeletionDate: "2026-11-10T00:00:00.000Z" }),
      ]),
    );
    const { container } = render(<DeletionRequestsPage />);

    expect(await screen.findByText("jane@example.com")).toBeTruthy();
    expect(screen.getByText("Deleted user")).toBeTruthy();
    expect(screen.getByText("Privacy concern")).toBeTruthy();
    // Long free text is truncated in the cell.
    expect(container.textContent).not.toContain("x".repeat(120));
  });

  it("refetches page 1 with the chosen status filter", async () => {
    getDeletionInsights.mockResolvedValue(insights([row({})]));
    render(<DeletionRequestsPage />);
    await screen.findByText("jane@example.com");

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "completed" } });

    await waitFor(() =>
      expect(getDeletionInsights).toHaveBeenLastCalledWith({ status: "completed", page: 1, limit: 20 }),
    );
  });

  it("shows an error message when the request fails", async () => {
    getDeletionInsights.mockRejectedValue(new Error("boom"));
    render(<DeletionRequestsPage />);
    expect(await screen.findByText("boom")).toBeTruthy();
  });
});
