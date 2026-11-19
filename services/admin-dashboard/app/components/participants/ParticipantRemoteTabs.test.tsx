// services/admin-dashboard/app/components/participants/ParticipantRemoteTabs.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { ParticipantProfileTabs, type ParticipantTabsData } from "./ParticipantProfileTabs";
import { EditHistoryTab } from "./tabs/EditHistoryTab";
import { PaymentsTab } from "./tabs/PaymentsTab";
import type { ApplicationEditHistoryEntry, InvoiceListItem } from "@/src/shared/api-client";

const api = vi.hoisted(() => ({
  getApplicationEditHistory: vi.fn(),
  listProgramInvoices: vi.fn(),
  downloadInvoiceProof: vi.fn(),
}));
vi.mock("@/src/shared/api-client", () => api);
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (m: string) => toastError(m) } }));

function withProviders(searchParams = "") {
  // staleTime as in app/providers.tsx, so switching tabs reuses cached queries like the real page.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  const Nuqs = withNuqsTestingAdapter({ searchParams });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <Nuqs>{children}</Nuqs>
      </QueryClientProvider>
    );
  };
}

const history: ApplicationEditHistoryEntry[] = [
  {
    id: "h1",
    editedAt: "2026-11-18T03:00:00.000Z",
    reason: "Participant asked to fix phone",
    editor: { id: "u1", name: "Rina Admin", email: "rina@ybb.test" },
    changes: [{ key: "personalData.phone_number", old: "", new: "+62811" }],
  },
  { id: "h2", editedAt: "2026-11-17T03:00:00.000Z", reason: null, editor: null, changes: [] },
];

const invoice = {
  id: "inv-1",
  applicationId: "app-1",
  amount: 15,
  currency: "USD",
  status: "paid",
  paymentMethod: "Bank transfer (manual)",
  paidAt: "2026-11-10T03:00:00.000Z",
  createdAt: "2026-11-09T03:00:00.000Z",
  updatedAt: "2026-11-10T03:00:00.000Z",
  pricingTier: { id: "t1", name: "Early bird", feeType: "registration_fee", usdPrice: 15, idrPrice: null },
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: "Blurry receipt",
  followUpStatus: "manual_proof_rejected",
} as unknown as InvoiceListItem;

const tabsData = {
  personal: { extraFields: [] },
  professional: { experience: [], achievements: [], resume: "", extraFields: [] },
  entry: { extraFields: [] },
  misc: { instagram: "", extraFields: [] },
  essays: [],
  submitted: { sections: [] },
} as unknown as ParticipantTabsData;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Edit History tab", () => {
  it("fetches only once the tab is opened, then lists edits with resolved labels", async () => {
    api.getApplicationEditHistory.mockResolvedValue(history);
    render(
      <ParticipantProfileTabs
        data={tabsData}
        remote={{ programId: "p1", applicationId: "app-1", changeLabels: new Map([["personalData.phone_number", "WhatsApp number"]]) }}
      />,
      { wrapper: withProviders() },
    );
    expect(api.getApplicationEditHistory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Edit History" }));
    expect(await screen.findByText("Rina Admin")).toBeInTheDocument();
    expect(api.getApplicationEditHistory).toHaveBeenCalledWith("app-1");
    expect(screen.getByText("WhatsApp number")).toBeInTheDocument();
    expect(screen.getByText("(empty)")).toBeInTheDocument();
    expect(screen.getByText("+62811")).toBeInTheDocument();
    expect(screen.getByText("Unknown admin")).toBeInTheDocument();
    expect(screen.getByText("No reason given")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    api.getApplicationEditHistory.mockResolvedValue([]);
    render(<EditHistoryTab applicationId="app-1" changeLabels={new Map()} />, { wrapper: withProviders() });
    expect(await screen.findByText("No admin edits yet")).toBeInTheDocument();
  });

  it("shows the error with a working retry", async () => {
    api.getApplicationEditHistory.mockRejectedValueOnce(new Error("Application not found")).mockResolvedValue([]);
    render(<EditHistoryTab applicationId="app-1" changeLabels={new Map()} />, { wrapper: withProviders() });
    expect(await screen.findByText("Application not found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No admin edits yet")).toBeInTheDocument();
  });
});

describe("Payments tab", () => {
  it("loads this application's invoices and toasts a missing proof", async () => {
    api.listProgramInvoices.mockResolvedValue({ data: [invoice], meta: { total: 1 } });
    api.downloadInvoiceProof.mockRejectedValue(new Error("No payment proof available"));
    render(<PaymentsTab programId="p1" applicationId="app-1" />, { wrapper: withProviders() });

    expect(await screen.findByText("Registration Fee")).toBeInTheDocument();
    expect(api.listProgramInvoices).toHaveBeenCalledWith({ programId: "p1", applicationId: "app-1", limit: 200 });
    expect(screen.getByText("Early bird")).toBeInTheDocument();
    expect(screen.getByText("Blurry receipt")).toBeInTheDocument();
    expect(screen.getByText("Manual Proof Rejected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open payment/ })).toHaveAttribute("href", "/programs/p1/payments/inv-1");
    expect(screen.queryByText(/Showing 1 of/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Download payment proof" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("No payment proof available"));
    expect(api.downloadInvoiceProof).toHaveBeenCalledWith("inv-1");
  });

  it("shows the empty state", async () => {
    api.listProgramInvoices.mockResolvedValue({ data: [], meta: { total: 0 } });
    render(<PaymentsTab programId="p1" applicationId="app-1" />, { wrapper: withProviders() });
    expect(await screen.findByText("No invoices yet")).toBeInTheDocument();
  });

  it("says when not every invoice is shown and links to the payments search", async () => {
    api.listProgramInvoices.mockResolvedValue({ data: [invoice], meta: { total: 250 } });
    render(<PaymentsTab programId="p1" applicationId="app-1" participantEmail="a+b@ybb.test" />, { wrapper: withProviders() });
    expect(await screen.findByText(/Showing 1 of 250 invoices/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all in Payments" })).toHaveAttribute(
      "href",
      "/programs/p1/payments?search=a%2Bb%40ybb.test",
    );
  });
});

describe("As Submitted tab", () => {
  const submitted = {
    sections: [
      {
        section: "p",
        label: "Personal",
        fields: [{ key: "personalData.phone_number", name: "phone_number", label: "Phone", value: "+62811", isLink: false }],
      },
    ],
  };
  const remote = { programId: "p1", applicationId: "app-1", changeLabels: new Map(), changeFields: new Map() };

  it("reuses the Edit History query: one fetch for both tabs, edited fields marked", async () => {
    api.getApplicationEditHistory.mockResolvedValue(history);
    render(<ParticipantProfileTabs data={{ ...tabsData, submitted }} remote={remote} />, {
      wrapper: withProviders("?tab=submitted"),
    });
    expect(await screen.findByText("Edited by admin")).toBeInTheDocument();
    expect(screen.getByText("(empty)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit History" }));
    expect(await screen.findByText("Rina Admin")).toBeInTheDocument();
    expect(api.getApplicationEditHistory).toHaveBeenCalledTimes(1);
  });

  it("still renders the form when the history request fails", async () => {
    api.getApplicationEditHistory.mockRejectedValue(new Error("boom"));
    render(<ParticipantProfileTabs data={{ ...tabsData, submitted }} remote={remote} />, {
      wrapper: withProviders("?tab=submitted"),
    });
    expect(screen.getByText("+62811")).toBeInTheDocument();
    await waitFor(() => expect(api.getApplicationEditHistory).toHaveBeenCalled());
    expect(screen.queryByText("Edited by admin")).toBeNull();
  });
});
