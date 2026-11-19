// services/admin-dashboard/app/components/settings/adminManagement/InviteAdminDialog.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InviteAdminDialog, INVITE_EMAIL_FAILED_MESSAGE } from "./InviteAdminDialog";
import { PLATFORM_ROLE_WARNING, participantAccountWarning } from "./AdminAccessFields";

const inviteAdmin = vi.fn();
const checkAdminInvite = vi.fn();
const toastSuccess = vi.fn();
const toastWarning = vi.fn();

vi.mock("@/src/shared/api-client", () => ({
  inviteAdmin: (...a: unknown[]) => inviteAdmin(...a),
  checkAdminInvite: (...a: unknown[]) => checkAdminInvite(...a),
}));
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), warning: (...a: unknown[]) => toastWarning(...a), error: vi.fn() },
}));

const role = (id: string, name: string, permissions: string[]) => ({ id, name, permissions, isActive: true });
const ROLES = [role("r1", "Reviewer", ["review:read"]), role("r2", "Ops Lead", ["admin.manage"])];
const PROGRAMS = [
  { id: "p1", name: "JYS 5th", brandName: "JYS" },
  { id: "p2", name: "WYF 2026", brandName: "WYF" },
];

function renderDialog(onInvited = vi.fn(), onClose = vi.fn()) {
  render(<InviteAdminDialog roles={ROLES} programs={PROGRAMS} onClose={onClose} onInvited={onInvited} />);
  return { onInvited, onClose };
}

function fill() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Dewi Lestari" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Dewi@Example.com" } });
  fireEvent.change(screen.getByLabelText("Role"), { target: { value: "r1" } });
  fireEvent.click(screen.getByLabelText("WYF 2026"));
}

describe("InviteAdminDialog", () => {
  beforeEach(() => {
    inviteAdmin.mockReset();
    checkAdminInvite.mockReset();
    checkAdminInvite.mockResolvedValue({ existingAdminId: null, participantBrands: [] });
    toastSuccess.mockReset();
    toastWarning.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("has name, email, role and programs, and no password field anywhere", () => {
    renderDialog();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    expect(screen.getByLabelText("WYF 2026")).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
  });

  it("warns when the chosen role is platform-tier", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "r2" } });
    expect(screen.getByText(PLATFORM_ROLE_WARNING)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "r1" } });
    expect(screen.queryByText(PLATFORM_ROLE_WARNING)).not.toBeInTheDocument();
  });

  it("checks the email once, debounced after blur, and shows the participant-account warning", async () => {
    vi.useFakeTimers();
    checkAdminInvite.mockResolvedValue({ existingAdminId: null, participantBrands: ["IYS", "KYS"] });
    renderDialog();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Dewi@Example.com" } });
    fireEvent.blur(screen.getByLabelText("Email"));
    expect(checkAdminInvite).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(checkAdminInvite).toHaveBeenCalledTimes(1);
    expect(checkAdminInvite).toHaveBeenCalledWith("dewi@example.com");
    expect(screen.getByText(participantAccountWarning(["IYS", "KYS"], "Inviting"))).toBeInTheDocument();
  });

  it("does not check an invalid email", async () => {
    vi.useFakeTimers();
    renderDialog();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.blur(screen.getByLabelText("Email"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(checkAdminInvite).not.toHaveBeenCalled();
  });

  it("says the email is already an admin and blocks Send invite", async () => {
    vi.useFakeTimers();
    checkAdminInvite.mockResolvedValue({ existingAdminId: "admin-9", participantBrands: [] });
    renderDialog();
    fill();
    fireEvent.blur(screen.getByLabelText("Email"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.getByText(/already belongs to an admin/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
  });

  it("sends the invite with the normalized email, then toasts", async () => {
    inviteAdmin.mockResolvedValue({ adminId: "a1", roleId: "r1", programIds: ["p2"], emailSent: true });
    const { onInvited, onClose } = renderDialog();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() => expect(onInvited).toHaveBeenCalled());
    expect(inviteAdmin).toHaveBeenCalledWith({
      fullName: "Dewi Lestari", email: "dewi@example.com", roleId: "r1", programIds: ["p2"],
    });
    expect(toastSuccess).toHaveBeenCalledWith("Invite sent to dewi@example.com");
    expect(onClose).toHaveBeenCalled();
  });

  it("warns, but still closes, when the invite email failed", async () => {
    inviteAdmin.mockResolvedValue({ adminId: "a1", roleId: "r1", programIds: [], emailSent: false });
    const { onInvited } = renderDialog();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() => expect(toastWarning).toHaveBeenCalledWith(INVITE_EMAIL_FAILED_MESSAGE));
    expect(INVITE_EMAIL_FAILED_MESSAGE).toBe(
      "Admin created, but the invite email failed. Use Send password link on their row.",
    );
    expect(onInvited).toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows the API message and stays open on a 409", async () => {
    inviteAdmin.mockRejectedValue(new Error('This email already belongs to an admin. Use "Send password link" instead.'));
    const { onInvited, onClose } = renderDialog();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(await screen.findByText(/already belongs to an admin/)).toBeInTheDocument();
    expect(onInvited).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
