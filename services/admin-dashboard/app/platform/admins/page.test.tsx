// services/admin-dashboard/app/platform/admins/page.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import AdminsPage from "./page";

const admin = (id: string, fullName: string, isActive: boolean) => ({
  id,
  userId: `u-${id}`,
  fullName,
  roleId: null,
  role: null,
  user: { id: `u-${id}`, email: `${id}@example.com`, isActive, createdAt: "2026-11-01T00:00:00Z" },
  brandIds: [],
  createdAt: "2026-11-01T00:00:00Z",
});

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    adminProfile: { id: "me" },
    accessiblePrograms: [],
    accessConfig: { canManageAdmins: true },
  }),
}));
vi.mock("../../components/settings/adminManagement/AccessRequestsPanel", () => ({ AccessRequestsPanel: () => null }));
vi.mock("../../../src/shared/api-client", () => ({
  listAdmins: () =>
    Promise.resolve({
      data: [admin("a1", "Active Person", true), admin("a2", "Inactive Person", false)],
      meta: { total: 2, totalPages: 1 },
    }),
  listAdminRoles: () => Promise.resolve([]),
  getPendingAccessRequestCount: () => Promise.resolve({ count: 0 }),
  updateAdmin: vi.fn(),
  deleteAdmin: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

describe("/platform/admins rows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers Send password link for active admins but not inactive ones (the API 409s for them)", async () => {
    render(<AdminsPage />);

    expect(await screen.findByLabelText("Send password link to Active Person")).toBeInTheDocument();
    expect(screen.queryByLabelText("Send password link to Inactive Person")).not.toBeInTheDocument();
  });

  it("opens the invite dialog from the header button", async () => {
    render(<AdminsPage />);
    (await screen.findByRole("button", { name: /Invite Administrator/ })).click();

    expect(await screen.findByRole("button", { name: "Send invite" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});
