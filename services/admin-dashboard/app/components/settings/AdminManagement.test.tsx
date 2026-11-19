// services/admin-dashboard/app/components/settings/AdminManagement.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AdminManagement } from "./AdminManagement";

const inviteAdmin = vi.fn();
const toastSuccess = vi.fn();
const toastWarning = vi.fn();

vi.mock("@/app/contexts/AuthContext", async (importOriginal) => ({
  // computeAccessConfig is real: the role warning in the shared fields uses it.
  ...(await importOriginal<typeof import("@/app/contexts/AuthContext")>()),
  useAuth: () => ({
    adminProfile: { id: "me" },
    accessConfig: { canManageAdmins: true },
    accessiblePrograms: [
      { programId: "p1", programName: "JYS 5th", brandName: "JYS" },
      { programId: "p2", programName: "WYF 2026", brandName: "WYF" },
    ],
  }),
}));
vi.mock("@/app/hooks/useResolvedProgramId", () => ({ useResolvedProgramId: (id: string) => id }));
vi.mock("@/src/shared/api-client", () => ({
  listAdmins: () => Promise.resolve({ data: [], meta: { total: 0, totalPages: 1 } }),
  listAdminRoles: () => Promise.resolve([{ id: "r1", name: "Reviewer", permissions: ["review:read"], isActive: true }]),
  getAdmin: vi.fn(),
  updateAdmin: vi.fn(),
  deleteAdmin: vi.fn(),
  checkAdminInvite: () => Promise.resolve({ existingAdminId: null, participantBrands: [] }),
  inviteAdmin: (...a: unknown[]) => inviteAdmin(...a),
}));
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), warning: (...a: unknown[]) => toastWarning(...a), error: vi.fn() },
}));

async function openInvite() {
  render(<AdminManagement programId="p2" programName="WYF 2026" allPrograms={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: /Invite Administrator/ }));
  return within(await screen.findByRole("dialog"));
}

describe("AdminManagement create flow", () => {
  beforeEach(() => {
    inviteAdmin.mockReset();
    toastSuccess.mockReset();
    toastWarning.mockReset();
  });

  it("opens the invite fields with no password input and the current program pre-ticked", async () => {
    const dialog = await openInvite();

    expect(dialog.getByLabelText("Full name")).toBeInTheDocument();
    expect(dialog.getByLabelText("Email")).toBeInTheDocument();
    expect(dialog.getByLabelText("Role")).toBeInTheDocument();
    expect(dialog.getByLabelText("WYF 2026")).toBeChecked();
    expect(dialog.getByLabelText("JYS 5th")).not.toBeChecked();
    expect(dialog.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(document.querySelector('[role="dialog"] input[type="password"]')).toBeNull();
    expect(dialog.getByRole("button", { name: "Send invite" })).toBeDisabled();
  });

  it("lets the user change the program, then sends the invite", async () => {
    inviteAdmin.mockResolvedValue({ adminId: "a1", roleId: "r1", programIds: ["p1"], emailSent: true });
    const dialog = await openInvite();

    fireEvent.change(dialog.getByLabelText("Full name"), { target: { value: "Dewi Lestari" } });
    fireEvent.change(dialog.getByLabelText("Email"), { target: { value: "dewi@example.com" } });
    fireEvent.change(dialog.getByLabelText("Role"), { target: { value: "r1" } });
    fireEvent.click(dialog.getByLabelText("WYF 2026"));
    fireEvent.click(dialog.getByLabelText("JYS 5th"));
    fireEvent.click(dialog.getByRole("button", { name: "Send invite" }));

    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Invite sent to dewi@example.com"));
    expect(inviteAdmin).toHaveBeenCalledWith({
      fullName: "Dewi Lestari", email: "dewi@example.com", roleId: "r1", programIds: ["p1"],
    });
  });
});
