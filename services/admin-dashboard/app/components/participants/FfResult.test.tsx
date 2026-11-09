// services/admin-dashboard/app/components/participants/FfResult.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FfResultBadge, FfResultBulkAction } from "./FfResult";

const setDecision = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/src/shared/api-client", () => ({
  setApplicationsFundingDecision: (...args: unknown[]) => setDecision(...args),
}));
vi.mock("sonner", () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }));

describe("FfResultBadge", () => {
  it("shows the result for a fully funded row", () => {
    render(<FfResultBadge category="fully_funded" decision="awarded" />);
    expect(screen.getByText("Awarded")).toBeInTheDocument();
  });

  it("shows a dash for self funded rows even if a stale decision is present", () => {
    render(<FfResultBadge category="self_funded" decision="awarded" />);
    expect(screen.queryByText("Awarded")).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("FfResultBulkAction", () => {
  beforeEach(() => {
    setDecision.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders nothing when no rows are selected", () => {
    const { container } = render(<FfResultBulkAction programId="p1" selectedIds={[]} onDone={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("confirms with the count and the no-email note before calling the API", async () => {
    setDecision.mockResolvedValue({ updated: 3 });
    const onDone = vi.fn();
    render(<FfResultBulkAction programId="p1" selectedIds={["a", "b", "c"]} onDone={onDone} />);

    fireEvent.click(screen.getByRole("button", { name: "Awarded" }));
    expect(screen.getByText(/3 selected applicants/)).toHaveTextContent("No email is sent");
    expect(setDecision).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Set result" }));
    await waitFor(() => expect(setDecision).toHaveBeenCalledWith("p1", ["a", "b", "c"], "awarded"));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith("Updated 3 of 3");
  });

  it("explains the skip rule when the server updates fewer rows than selected", async () => {
    setDecision.mockResolvedValue({ updated: 1 });
    render(<FfResultBulkAction programId="p1" selectedIds={["a", "b"]} onDone={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Not awarded" }));
    fireEvent.click(screen.getByRole("button", { name: "Set result" }));

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Updated 1 of 2 (only submitted Fully Funded applications can get a result)",
      ),
    );
  });

  it("sends null for Clear and keeps the selection when the call fails", async () => {
    setDecision.mockRejectedValue(new Error("boom"));
    const onDone = vi.fn();
    render(<FfResultBulkAction programId="p1" selectedIds={["a"]} onDone={onDone} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear result" }));

    await waitFor(() => expect(setDecision).toHaveBeenCalledWith("p1", ["a"], null));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("boom"));
    expect(onDone).not.toHaveBeenCalled();
  });
});
