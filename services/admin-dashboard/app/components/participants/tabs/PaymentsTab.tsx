// services/admin-dashboard/app/components/participants/tabs/PaymentsTab.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, FileDown, Receipt } from "lucide-react";
import { downloadInvoiceProof, listProgramInvoices, type InvoiceListItem } from "@/src/shared/api-client";
import { EmptyState } from "@/src/admin/empty-state";
import { Button } from "@/src/ui/button";
import { formatDate, formatDateTime } from "@/lib/utils";
import { humanizeStatus } from "@/lib/application-badges";
import { formatInvoiceAmount, paidTotalsByCurrency } from "@/lib/invoice-badges";
import { FollowUpPill, InvoiceStatusPill } from "@/app/components/payments/InvoicePills";
import { CopyButton } from "../IconActions";
import { TabError, TabSkeleton } from "./TabLoadStates";

// The API's cap for one application (program-wide lists stop at 100).
const INVOICE_LIMIT = 200;

interface PaymentsTabProps {
  programId: string;
  applicationId: string;
  /** Used for the payments-page search link when not every invoice fits. */
  participantEmail?: string;
}

/** Mounted only while the tab is open, so the first fetch happens on first open. */
export function PaymentsTab({ programId, applicationId, participantEmail }: PaymentsTabProps) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["application-invoices", programId, applicationId],
    queryFn: () => listProgramInvoices({ programId, applicationId, limit: INVOICE_LIMIT }),
    select: (res) => ({ invoices: res.data, total: res.meta.total }),
  });

  if (isPending) return <TabSkeleton label="Loading invoices" />;
  if (isError) return <TabError title="Couldn't load invoices" error={error} onRetry={() => void refetch()} />;
  if (data.invoices.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No invoices yet"
        description="Invoices are created when the participant starts a payment."
      />
    );
  }
  return (
    <InvoiceList invoices={data.invoices} total={data.total} programId={programId} participantEmail={participantEmail} />
  );
}

interface InvoiceListProps {
  invoices: InvoiceListItem[];
  /** All of this application's invoices; more than `invoices.length` when the list was capped. */
  total?: number;
  programId: string;
  participantEmail?: string;
}

export function InvoiceList({ invoices, total = invoices.length, programId, participantEmail }: InvoiceListProps) {
  const totals = paidTotalsByCurrency(invoices);
  const isCapped = total > invoices.length;
  const email = participantEmail?.trim();
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Total paid{isCapped ? " (shown invoices)" : ""}:{" "}
        <span className="font-semibold text-zinc-900">
          {totals.length ? totals.map((t) => formatInvoiceAmount(t.amount, t.currency)).join(" + ") : "nothing yet"}
        </span>
        <span className="text-zinc-400"> · {invoices.length} invoice{invoices.length === 1 ? "" : "s"}</span>
      </p>
      {isCapped && (
        <p className="text-xs text-zinc-500">
          Showing {invoices.length} of {total} invoices.{" "}
          {email && (
            <Link
              href={`/programs/${programId}/payments?search=${encodeURIComponent(email)}`}
              className="font-medium text-blue-600 hover:underline"
            >
              See all in Payments
            </Link>
          )}
        </p>
      )}
      <ul className="space-y-3">
        {invoices.map((inv) => (
          <InvoiceRow key={inv.id} invoice={inv} programId={programId} />
        ))}
      </ul>
    </div>
  );
}

function InvoiceRow({ invoice: inv, programId }: { invoice: InvoiceListItem; programId: string }) {
  return (
    <li className="rounded-lg border border-zinc-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">{humanizeStatus(inv.pricingTier.feeType)}</p>
          <p className="text-xs text-zinc-500">{inv.pricingTier.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900">{formatInvoiceAmount(inv.amount, inv.currency)}</span>
          <InvoiceStatusPill status={inv.status} />
          <FollowUpPill status={inv.followUpStatus} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:grid-cols-4">
        <Meta label="Method" value={inv.paymentMethod ?? "—"} />
        <Meta label="Created" value={formatDate(inv.createdAt)} />
        <Meta label="Paid" value={inv.paidAt ? formatDateTime(inv.paidAt) : "—"} />
        {/* verifiedBy is a user id, not a name: kept as a tooltip rather than shown raw. */}
        {inv.verifiedAt && <Meta label="Verified" value={formatDateTime(inv.verifiedAt)} title={inv.verifiedBy ?? undefined} />}
      </dl>

      {inv.rejectionReason && (
        <p className="mt-2 text-sm text-red-600">
          <span className="font-medium">Rejected:</span> {inv.rejectionReason}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/programs/${programId}/payments/${inv.id}`}>
            Open payment
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
        <ProofButton invoiceId={inv.id} />
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-zinc-400">
          {inv.id}
          <CopyButton text={inv.id} label="Invoice ID" />
        </span>
      </div>
    </li>
  );
}

function Meta({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="truncate font-medium text-zinc-700" title={title ?? value}>
        {value}
      </dd>
    </div>
  );
}

function ProofButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      await downloadInvoiceProof(invoiceId);
    } catch (err) {
      // 404 "No payment proof available" is the normal answer for gateway payments.
      toast.error(err instanceof Error ? err.message : "Couldn't download the payment proof.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={() => void handleDownload()} aria-label="Download payment proof">
      {!loading && <FileDown className="h-3.5 w-3.5" aria-hidden="true" />}
      Proof
    </Button>
  );
}
