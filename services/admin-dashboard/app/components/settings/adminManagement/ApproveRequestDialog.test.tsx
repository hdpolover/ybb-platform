// services/admin-dashboard/app/components/settings/adminManagement/ApproveRequestDialog.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApproveRequestDialog, PLATFORM_ROLE_WARNING } from "./ApproveRequestDialog";

const approveAccessRequest = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/src/shared/api-client", () => ({
  approveAccessRequest: (...a: unknown[]) => approveAccessRequest(...a),
}));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));

const role = (id: string, name: string, permissions: string[]) => ({ id, name, permissions, isActive: true });
const ROLES = [role("r1", "Reviewer", ["review:read"]), role("r2", "Ops Lead", ["admin.manage"])];
const PROGRAMS = [
  { id: "p1", name: "JYS 5th", brandName: "JYS" },
  { id: "p2", name: "WYF 2026", brandName: "WYF" },
];
const REQUEST = {
  id: "req1",
  fullName: "Dewi Lestari",
  email: "dewi@example.com",
  whatsapp: null,
  division: "ops",
  divisionLabel: "Operations",
  defaultRoleId: "r1",
  defaultRoleName: "Reviewer",
  requestedPrograms: [{ id: "p2", name: "WYF 2026", brandName: "WYF" }],
  note: null,
  status: "pending" as const,
  createdAt: "2026-11-19T00:00:00Z",
  reviewedAt: null,
  reviewedByName: null,
  rejectReason: null,
  existingAdminId: null,
};

const renderDialog = (request = REQUEST, onApproved = vi.fn()) =>
  render(
    <ApproveRequestDialog request={request} roles={ROLES} programs={PROGRAMS} onClose={vi.fn()} onApproved={onApproved} />,
  );

describe("ApproveRequestDialog", () => {
  beforeEach(() => {
    approveAccessRequest.mockReset();
    toastSuccess.mockReset();
  });

  it("prefills the default role and the requested programs", () => {
    renderDialog();
    expect(screen.getByLabelText("Role")).toHaveValue("r1");
    expect(screen.getByLabelText("WYF 2026")).toBeChecked();
    expect(screen.getByLabelText("JYS 5th")).not.toBeChecked();
    expect(screen.queryByText(PLATFORM_ROLE_WARNING)).not.toBeInTheDocument();
  });

  it("leaves the role empty and blocks approval when there is no default role", () => {
    renderDialog({ ...REQUEST, defaultRoleId: null });
    expect(screen.getByLabelText("Role")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Approve and send invite" })).toBeDisabled();
  });

  it("warns when the chosen role is platform-tier", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "r2" } });
    expect(screen.getByText(PLATFORM_ROLE_WARNING)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "r1" } });
    expect(screen.queryByText(PLATFORM_ROLE_WARNING)).not.toBeInTheDocument();
  });

  it("approves with the edited role and programs, then toasts", async () => {
    approveAccessRequest.mockResolvedValue({ adminId: "a1" });
    const onApproved = vi.fn();
    renderDialog(REQUEST, onApproved);

    fireEvent.click(screen.getByLabelText("JYS 5th"));
    fireEvent.click(screen.getByRole("button", { name: "Approve and send invite" }));

    await waitFor(() => expect(onApproved).toHaveBeenCalled());
    expect(approveAccessRequest).toHaveBeenCalledWith("req1", { roleId: "r1", programIds: ["p2", "p1"] });
    expect(toastSuccess).toHaveBeenCalledWith("Approved. Invite email sent.");
  });

  it("shows the API message on a 409 and keeps the dialog open", async () => {
    approveAccessRequest.mockRejectedValue(new Error("Email is already an admin"));
    const onApproved = vi.fn();
    renderDialog(REQUEST, onApproved);

    fireEvent.click(screen.getByRole("button", { name: "Approve and send invite" }));

    expect(await screen.findByText("Email is already an admin")).toBeInTheDocument();
    expect(onApproved).not.toHaveBeenCalled();
  });
});
