// services/admin-dashboard/app/platform/admins/page.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AdminsPage from "./page";
import { getAdmin, updateAdmin } from "../../../src/shared/api-client";

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

vi.mock("../../contexts/AuthContext", async (importOriginal) => ({
  // computeAccessConfig is real: the platform-tier role check uses it.
  ...(await importOriginal<typeof import("../../contexts/AuthContext")>()),
  useAuth: () => ({
    adminProfile: { id: "me" },
    accessiblePrograms: [
      { programId: "p1", programName: "JYS 5th", brandName: "JYS" },
      { programId: "p2", programName: "WYF 2026", brandName: "WYF" },
    ],
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
  listAdminRoles: () =>
    Promise.resolve([{ id: "r1", name: "Reviewer", permissions: ["review:read"], isActive: true }]),
  getAdmin: vi.fn(),
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

  it("edit modal loads the admin's programs and sends roleId and programIds", async () => {
    vi.mocked(getAdmin).mockResolvedValue({
      ...admin("a1", "Active Person", true),
      programs: [{ programId: "p1", programName: "JYS 5th", brandId: "b1", permissions: [] }],
    } as never);
    vi.mocked(updateAdmin).mockResolvedValue({} as never);
    render(<AdminsPage />);
    fireEvent.click((await screen.findAllByTitle("Edit admin"))[0]);

    const p1 = await screen.findByLabelText("JYS 5th");
    await waitFor(() => expect(p1).toBeChecked());
    fireEvent.click(screen.getByLabelText("WYF 2026"));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "r1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(updateAdmin).toHaveBeenCalledWith("a1", {
        fullName: "Active Person",
        roleId: "r1",
        isActive: true,
        programIds: ["p1", "p2"],
      }),
    );
  });

  it("edit modal refuses to save a scoped role with no program", async () => {
    vi.mocked(getAdmin).mockResolvedValue(admin("a1", "Active Person", true) as never);
    render(<AdminsPage />);
    fireEvent.click((await screen.findAllByTitle("Edit admin"))[0]);

    await waitFor(() => expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "r1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Assign at least one program.")).toBeInTheDocument();
    expect(updateAdmin).not.toHaveBeenCalled();
  });
});
