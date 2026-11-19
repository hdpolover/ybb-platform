// services/admin-dashboard/app/components/participants/ParticipantDetailPieces.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { SubmittedFormTab } from "./tabs/SubmittedFormTab";
import { ParticipantProfileTabs, type ParticipantTabsData } from "./ParticipantProfileTabs";
import { CopySummaryButton } from "./CopySummaryButton";
import { InvalidPhoneFlag } from "./InvalidPhoneFlag";
import { ParticipantNavBar } from "./ParticipantNavBar";
import { whatsappActions } from "./IconActions";
import { saveParticipantNav } from "@/lib/participant-nav";

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (m: string) => toastSuccess(m), error: vi.fn() } }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const tabsData = {
  personal: { extraFields: [] },
  professional: { experience: [], achievements: [], resume: "", extraFields: [] },
  entry: { extraFields: [] },
  misc: { instagram: "", extraFields: [] },
  essays: [],
  submitted: { sections: [] },
} as unknown as ParticipantTabsData;

describe("SubmittedFormTab", () => {
  it("shows answered and unanswered fields, with an open link for URLs", () => {
    render(
      <SubmittedFormTab
        data={{
          sections: [
            {
              section: "misc",
              label: "Extras",
              fields: [
                { name: "a", label: "Portfolio", value: "https://x.test/p", isLink: true },
                { name: "b", label: "Hobby", value: "", isLink: false },
              ],
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Extras" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Portfolio" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("button", { name: "Copy portfolio" })).toBeInTheDocument();
    expect(screen.getByText("Not answered")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy hobby" })).toBeNull();
  });

  it("shows the empty state when the application has no form", () => {
    render(<SubmittedFormTab data={{ sections: [] }} />);
    expect(screen.getByText("No submitted form")).toBeInTheDocument();
  });
});

describe("ParticipantProfileTabs", () => {
  it("opens the tab named in ?tab= and switches on click", () => {
    render(<ParticipantProfileTabs data={tabsData} remote={{ programId: "p", applicationId: "a", changeLabels: new Map() }} />, {
      wrapper: withNuqsTestingAdapter({ searchParams: "?tab=submitted" }),
    });
    expect(screen.getByText("No submitted form")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Essays" }));
    expect(screen.queryByText("No submitted form")).toBeNull();
  });
});

describe("phone validity", () => {
  it("hides WhatsApp only when explicitly invalid", () => {
    expect(whatsappActions("+923347354006", false)).toEqual([]);
    expect(whatsappActions("+923347354006", true)).toHaveLength(1);
    expect(whatsappActions("+923347354006", undefined)).toHaveLength(1);
    expect(whatsappActions("+923347354006", null)).toHaveLength(1);
  });

  it("renders the flag only for false", () => {
    const { rerender, container } = render(<InvalidPhoneFlag valid={false} />);
    expect(screen.getByText("Format looks invalid")).toHaveAttribute(
      "title",
      "This number failed phone-format validation. Double-check before contacting.",
    );
    rerender(<InvalidPhoneFlag valid={undefined} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<InvalidPhoneFlag valid={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CopySummaryButton", () => {
  beforeEach(() => toastSuccess.mockClear());

  it("copies the summary and toasts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <CopySummaryButton
        fields={{
          name: "Aisha", email: "a@b.co", phone: "—", program: "WYF", category: "", applicationStatus: "Submitted",
          registrationFee: "Paid", programFee: "Unpaid", nationality: "", institution: "", major: "",
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy profile summary" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Profile summary copied"));
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toMatch(/^Name: Aisha\nEmail: a@b.co\nProgram: WYF\nApplication status: Submitted/);
    expect(text).not.toContain("Phone");
    expect(text).toMatch(/Admin link: http/);
  });
});

describe("ParticipantNavBar", () => {
  beforeEach(() => {
    sessionStorage.clear();
    push.mockClear();
    saveParticipantNav("p1", { ids: ["a", "b", "c"], listHref: "/programs/p1/participants?page=2" });
  });
  const wrapper = withNuqsTestingAdapter({ searchParams: "?tab=essays" });

  it("renders nothing without saved nav or when the participant is not in it", () => {
    const { container } = render(<ParticipantNavBar programParam="p1" accountId="zzz" />, { wrapper });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows position, disables Prev at the start, and [ ] keys keep the tab", async () => {
    render(<ParticipantNavBar programParam="p1" accountId="a" />, { wrapper });
    expect(await screen.findByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous participant" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Back to list" })).toHaveAttribute("href", "/programs/p1/participants?page=2");
    fireEvent.keyDown(window, { key: "[" });
    expect(push).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "]" });
    expect(push).toHaveBeenCalledWith("/programs/p1/participants/b?tab=essays");
  });

  it("ignores keys while typing or when a dialog is open", async () => {
    render(
      <>
        <input aria-label="q" />
        <ParticipantNavBar programParam="p1" accountId="b" />
      </>,
      { wrapper },
    );
    await screen.findByText("2 of 3");
    fireEvent.keyDown(screen.getByLabelText("q"), { key: "]" });
    expect(push).not.toHaveBeenCalled();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    fireEvent.keyDown(window, { key: "]" });
    expect(push).not.toHaveBeenCalled();
    dialog.remove();
  });
});
