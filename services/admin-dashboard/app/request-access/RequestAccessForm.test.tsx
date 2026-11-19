// services/admin-dashboard/app/request-access/RequestAccessForm.test.tsx
import { forwardRef, useImperativeHandle } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RequestAccessForm from "./RequestAccessForm";

const getAccessRequestOptions = vi.fn();
const submitAccessRequest = vi.fn();
const getTurnstileSiteKey = vi.fn();
const resetWidget = vi.fn();

vi.mock("@/src/shared/api-client", () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  },
  getAccessRequestOptions: (...a: unknown[]) => getAccessRequestOptions(...a),
  getTurnstileSiteKey: (...a: unknown[]) => getTurnstileSiteKey(...a),
  submitAccessRequest: (...a: unknown[]) => submitAccessRequest(...a),
}));

// Stand-in for the Cloudflare widget: two buttons drive its callbacks.
vi.mock("./TurnstileWidget", () => ({
  default: forwardRef(function FakeWidget(
    props: { onToken: (t: string) => void; onError: () => void },
    ref: React.Ref<{ reset: () => void }>,
  ) {
    useImperativeHandle(ref, () => ({ reset: resetWidget }));
    return (
      <div>
        <button type="button" onClick={() => props.onToken("tok-123")}>solve challenge</button>
        <button type="button" onClick={props.onError}>break challenge</button>
      </div>
    );
  }),
}));

const OPTIONS = {
  divisions: [{ key: "ops", label: "Operations" }],
  programs: [
    { id: "p1", name: "JYS 5th", brandName: "JYS" },
    { id: "p2", name: "WYF 2026", brandName: "WYF" },
  ],
};

async function fillValid() {
  await screen.findByRole("option", { name: "Operations" });
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Dewi Lestari" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "dewi@example.com" } });
  fireEvent.change(screen.getByLabelText("Division"), { target: { value: "ops" } });
}

describe("RequestAccessForm", () => {
  beforeEach(() => {
    getAccessRequestOptions.mockReset().mockResolvedValue(OPTIONS);
    submitAccessRequest.mockReset();
    getTurnstileSiteKey.mockReset().mockResolvedValue(null);
    resetWidget.mockReset();
  });

  it("shows validation errors and does not submit an invalid form", async () => {
    render(<RequestAccessForm />);
    await screen.findByRole("option", { name: "Operations" });

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Select your division.")).toBeInTheDocument();
    expect(submitAccessRequest).not.toHaveBeenCalled();
  });

  it("submits the contract body, groups programs by brand and shows the confirmation", async () => {
    submitAccessRequest.mockResolvedValue({ submitted: true });
    render(<RequestAccessForm />);
    await fillValid();

    expect(screen.getByText("JYS")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("JYS 5th"));
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Request sent. You'll get an email once a supervisor approves it.")).toBeInTheDocument();
    expect(submitAccessRequest).toHaveBeenCalledWith({
      fullName: "Dewi Lestari",
      email: "dewi@example.com",
      division: "ops",
      programIds: ["p1"],
    }, null);
  });

  it("disables the button while the request is pending so it cannot be double-submitted", async () => {
    let resolve!: (v: unknown) => void;
    submitAccessRequest.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<RequestAccessForm />);
    await fillValid();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    const pending = await screen.findByRole("button", { name: "Sending..." });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(submitAccessRequest).toHaveBeenCalledTimes(1);

    resolve({ submitted: true });
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
  });
});

describe("RequestAccessForm Turnstile", () => {
  beforeEach(() => {
    getAccessRequestOptions.mockReset().mockResolvedValue(OPTIONS);
    submitAccessRequest.mockReset();
    getTurnstileSiteKey.mockReset().mockResolvedValue("site-key");
    resetWidget.mockReset();
  });

  it("keeps submit disabled until the widget yields a token", async () => {
    render(<RequestAccessForm />);
    await fillValid();
    const submit = screen.getByRole("button", { name: "Send request" });
    expect(submit).toBeDisabled();

    fireEvent.click(await screen.findByRole("button", { name: "solve challenge" }));
    expect(submit).toBeEnabled();
  });

  it("sends the token to the API", async () => {
    submitAccessRequest.mockResolvedValue({ submitted: true });
    render(<RequestAccessForm />);
    await fillValid();
    fireEvent.click(await screen.findByRole("button", { name: "solve challenge" }));
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await screen.findByRole("status");
    expect(submitAccessRequest).toHaveBeenCalledWith(expect.objectContaining({ email: "dewi@example.com" }), "tok-123");
  });

  it("shows the human-check message on a 403, resets the widget and waits for a new token", async () => {
    const { ApiError } = await import("@/src/shared/api-client");
    submitAccessRequest.mockRejectedValue(new ApiError("Please complete the security check and try again.", 403));
    render(<RequestAccessForm />);
    await fillValid();
    fireEvent.click(await screen.findByRole("button", { name: "solve challenge" }));
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(
      await screen.findByText("We couldn't verify you're human. Reload the page and try again."),
    ).toBeInTheDocument();
    expect(resetWidget).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
  });

  it("lets the user submit when the widget errors, without a token", async () => {
    submitAccessRequest.mockResolvedValue({ submitted: true });
    render(<RequestAccessForm />);
    await fillValid();
    fireEvent.click(await screen.findByRole("button", { name: "break challenge" }));
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await screen.findByRole("status");
    expect(submitAccessRequest).toHaveBeenCalledWith(expect.anything(), null);
  });

  it("lets the user submit when the site key cannot be fetched", async () => {
    getTurnstileSiteKey.mockRejectedValue(new Error("offline"));
    render(<RequestAccessForm />);
    await fillValid();
    await waitFor(() => expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled());
  });
});
