// services/admin-dashboard/app/components/participants/InfoField.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InfoField } from "./InfoField";
import { whatsappActions } from "./IconActions";
import { countWords } from "./tabs/EssaysTab";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }));

describe("InfoField actions", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it("copies the value and toasts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<InfoField label="Phone Number" value="+923347354006" copyValue="+923347354006" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy phone number" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Phone Number copied"));
    expect(writeText).toHaveBeenCalledWith("+923347354006");
  });

  it("toasts an error when the clipboard rejects", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<InfoField label="Email" value="a@b.co" copyValue="a@b.co" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy email" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("hides actions for empty or placeholder values", () => {
    render(<InfoField label="Phone Number" value="—" copyValue="—" actions={whatsappActions("—")} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders whatsapp as a new-tab link", () => {
    render(<InfoField label="Phone" value="+923347354006" copyValue="+923347354006" actions={whatsappActions("+923347354006")} />);
    const link = screen.getByRole("link", { name: "Open in WhatsApp" });
    expect(link).toHaveAttribute("href", "https://wa.me/923347354006");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render non-http values as links", () => {
    render(<InfoField label="Twibbon" value="javascript:alert(1)" isLink />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("  one two\nthree  ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});
