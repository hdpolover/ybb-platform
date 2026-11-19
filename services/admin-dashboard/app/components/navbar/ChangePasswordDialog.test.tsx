// services/admin-dashboard/app/components/navbar/ChangePasswordDialog.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChangePasswordDialog, PASSWORD_CHANGED_MESSAGE } from "./ChangePasswordDialog";

const changeOwnPassword = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/src/shared/api-client", () => ({
  changeOwnPassword: (...a: unknown[]) => changeOwnPassword(...a),
}));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
}

describe("ChangePasswordDialog", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    changeOwnPassword.mockReset();
    toastSuccess.mockReset();
    onOpenChange.mockReset();
  });

  it.each([
    ["no current password", ["", "NewPassw0rd!", "NewPassw0rd!"], "Enter your current password."],
    ["too short", ["OldPassw0rd!", "Ab1!", "Ab1!"], "Password must be at least 8 characters."],
    ["missing character classes", ["OldPassw0rd!", "alllowercase", "alllowercase"], "Password must contain uppercase, lowercase, and a number or special character."],
    ["mismatched confirmation", ["OldPassw0rd!", "NewPassw0rd!", "Different1!"], "Passwords do not match."],
    ["same as current", ["OldPassw0rd!", "OldPassw0rd!", "OldPassw0rd!"], "New password must be different from the current one."],
  ])("blocks submit on %s", async (_label, [current, next, confirm], message) => {
    render(<ChangePasswordDialog open onOpenChange={onOpenChange} />);
    fill(current, next, confirm);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(changeOwnPassword).not.toHaveBeenCalled();
  });

  it("submits, toasts that other sessions were signed out and closes", async () => {
    changeOwnPassword.mockResolvedValue({ ok: true });
    render(<ChangePasswordDialog open onOpenChange={onOpenChange} />);
    fill("OldPassw0rd!", "NewPassw0rd!", "NewPassw0rd!");

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(changeOwnPassword).toHaveBeenCalledWith("OldPassw0rd!", "NewPassw0rd!");
    expect(toastSuccess).toHaveBeenCalledWith("Password changed. Other sessions were signed out.");
    expect(PASSWORD_CHANGED_MESSAGE).toBe("Password changed. Other sessions were signed out.");
  });

  it("shows the API's message and stays open when the current password is wrong", async () => {
    changeOwnPassword.mockRejectedValue(new Error("Current password is incorrect"));
    render(<ChangePasswordDialog open onOpenChange={onOpenChange} />);
    fill("wrong", "NewPassw0rd!", "NewPassw0rd!");

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
