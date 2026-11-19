// services/admin-dashboard/app/request-access/RequestAccessForm.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RequestAccessForm from "./RequestAccessForm";

const getAccessRequestOptions = vi.fn();
const submitAccessRequest = vi.fn();

vi.mock("@/src/shared/api-client", () => ({
  getAccessRequestOptions: (...a: unknown[]) => getAccessRequestOptions(...a),
  submitAccessRequest: (...a: unknown[]) => submitAccessRequest(...a),
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
    });
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
