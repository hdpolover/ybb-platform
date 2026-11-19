// services/admin-dashboard/app/forgot-password/ForgotPasswordForm.test.tsx
import { forwardRef, useImperativeHandle } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ForgotPasswordForm from "./ForgotPasswordForm";

const requestAdminPasswordReset = vi.fn();
const getTurnstileSiteKey = vi.fn();
const resetWidget = vi.fn();

vi.mock("@/src/shared/api-client", () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  },
  getTurnstileSiteKey: (...a: unknown[]) => getTurnstileSiteKey(...a),
  requestAdminPasswordReset: (...a: unknown[]) => requestAdminPasswordReset(...a),
}));

vi.mock("../request-access/TurnstileWidget", () => ({
  default: forwardRef(function FakeWidget(props: { onToken: (t: string) => void }, ref: React.Ref<{ reset: () => void }>) {
    useImperativeHandle(ref, () => ({ reset: resetWidget }));
    return <button type="button" onClick={() => props.onToken("tok-123")}>solve challenge</button>;
  }),
}));

const SENT = "If that email belongs to an admin, a reset link is on its way.";

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    requestAdminPasswordReset.mockReset();
    getTurnstileSiteKey.mockReset().mockResolvedValue("site-key");
    resetWidget.mockReset();
  });

  it("rejects a malformed email without calling the API", async () => {
    getTurnstileSiteKey.mockResolvedValue(null);
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nope" } });
    fireEvent.click(await screen.findByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(requestAdminPasswordReset).not.toHaveBeenCalled();
  });

  it("keeps submit disabled until the widget yields a token, then sends the email and token", async () => {
    requestAdminPasswordReset.mockResolvedValue({ submitted: true });
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " admin@example.com " } });
    const submit = screen.getByRole("button", { name: "Send reset link" });
    expect(submit).toBeDisabled();

    fireEvent.click(await screen.findByRole("button", { name: "solve challenge" }));
    fireEvent.click(submit);

    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(requestAdminPasswordReset).toHaveBeenCalledWith("admin@example.com", "tok-123");
  });

  it("shows the same message whatever the email is (the API answers identically)", async () => {
    getTurnstileSiteKey.mockResolvedValue(null);
    requestAdminPasswordReset.mockResolvedValue({ submitted: true });
    const first = render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "known@example.com" } });
    fireEvent.click(await screen.findByRole("button", { name: "Send reset link" }));
    const a = (await screen.findByRole("status")).textContent;
    first.unmount();

    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "stranger@example.com" } });
    fireEvent.click(await screen.findByRole("button", { name: "Send reset link" }));
    expect((await screen.findByRole("status")).textContent).toBe(a);
  });

  it("shows the human-check message on a 403 and resets the widget", async () => {
    const { ApiError } = await import("@/src/shared/api-client");
    requestAdminPasswordReset.mockRejectedValue(new ApiError("blocked", 403));
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    fireEvent.click(await screen.findByRole("button", { name: "solve challenge" }));
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't verify you're human");
    expect(resetWidget).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeDisabled();
  });
});
