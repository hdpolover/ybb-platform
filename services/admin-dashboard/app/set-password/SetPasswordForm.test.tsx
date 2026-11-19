// services/admin-dashboard/app/set-password/SetPasswordForm.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SetPasswordForm from "./SetPasswordForm";

// The spy only records calls; the rejection is made outside it (a spy-wrapped rejected promise is reported as unhandled by this vitest).
const setPasswordWithToken = vi.fn();
let rejectWith: Error | null = null;

vi.mock("@/src/shared/api-client", () => {
  class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return {
    ApiError,
    setPasswordWithToken: (...a: unknown[]) => {
      setPasswordWithToken(...a);
      return rejectWith ? Promise.reject(rejectWith) : Promise.resolve({});
    },
  };
});

const INVALID = /This link is invalid or expired; ask your supervisor for a new one/;

function submit(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
}

describe("SetPasswordForm", () => {
  beforeEach(() => {
    setPasswordWithToken.mockReset();
    rejectWith = null;
    window.history.replaceState(null, "", "/set-password?token=tok");
  });

  it("reads the token client-side and strips it from the URL", async () => {
    render(<SetPasswordForm />);
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/set-password");
  });

  it("still submits the token after the URL was stripped", async () => {
    render(<SetPasswordForm />);
    await screen.findByLabelText("New password");
    submit("Valid1234", "Valid1234");
    expect(await screen.findByText("Password set. You can sign in now.")).toBeInTheDocument();
    expect(setPasswordWithToken).toHaveBeenCalledWith("tok", "Valid1234");
  });

  it("shows the invalid-link state when the token is missing", async () => {
    window.history.replaceState(null, "", "/set-password");
    render(<SetPasswordForm />);
    expect(await screen.findByText(INVALID)).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("rejects weak or mismatched passwords before calling the API", async () => {
    render(<SetPasswordForm />);
    await screen.findByLabelText("New password");
    submit("weak", "weak");
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 8 characters/);
    submit("Valid1234", "Different1234");
    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(setPasswordWithToken).not.toHaveBeenCalled();
  });

  it("sets the password and links to /login", async () => {
    render(<SetPasswordForm />);
    await screen.findByLabelText("New password");
    submit("Valid1234", "Valid1234");

    expect(await screen.findByText("Password set. You can sign in now.")).toBeInTheDocument();
    expect(setPasswordWithToken).toHaveBeenCalledWith("tok", "Valid1234");
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/login");
  });

  it("falls to the invalid-link state when the API answers 400", async () => {
    const { ApiError } = await import("@/src/shared/api-client");
    rejectWith = new ApiError("Invalid token", 400);
    render(<SetPasswordForm />);
    await screen.findByLabelText("New password");
    submit("Valid1234", "Valid1234");

    expect(await screen.findByText(INVALID)).toBeInTheDocument();
  });
});
