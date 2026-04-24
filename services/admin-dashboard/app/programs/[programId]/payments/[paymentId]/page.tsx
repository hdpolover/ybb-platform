"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  UserCircle,
  CreditCard,
  ShieldCheck,
  ShieldX,
  ExternalLink,
} from "lucide-react";
import {
  getProgramInvoice,
  verifyInvoice,
  type InvoiceDetail,
  type InvoiceStatus,
} from "@/src/shared/api-client";
import { PageHeader } from "@/src/admin/page-header";
import { Button } from "@/src/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  refunded: "bg-purple-50 text-purple-700 border-purple-200",
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_CLASS[status as InvoiceStatus] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-zinc-100 last:border-0">
      <span className="w-44 shrink-0 text-sm text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-900 flex-1">{children}</span>
    </div>
  );
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PaymentDetailPage({
  params,
}: {
  params: Promise<{ programId: string; paymentId: string }>;
}) {
  const { programId, paymentId } = use(params);

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [verifyAction, setVerifyAction] = useState<"approve" | "reject" | null>(null);
  const [verifyReason, setVerifyReason] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function fetchInvoice() {
    setLoading(true);
    setError(null);
    try {
      const data = await getProgramInvoice(paymentId);
      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (paymentId) fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  async function handleVerify() {
    if (!verifyAction) return;
    setVerifyLoading(true);
    setToast(null);
    try {
      await verifyInvoice(paymentId, verifyAction, verifyReason || undefined);
      setToast({
        text: verifyAction === "approve" ? "Payment approved" : "Payment rejected",
        ok: true,
      });
      setVerifyAction(null);
      setVerifyReason("");
      setConfirmOpen(false);
      await fetchInvoice();
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : "Action failed", ok: false });
    } finally {
      setVerifyLoading(false);
    }
  }

  const txn = invoice?.transaction as Record<string, unknown> | null | undefined;
  const txnStatus = txn?.status as string | undefined;
  const needsReview = txnStatus === "NEEDS_REVIEW";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Detail"
        description={invoice?.participant.fullName ?? "Loading…"}
        breadcrumb={
          <Link
            href={`/programs/${programId}/payments`}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Payments
          </Link>
        }
        actions={
          <Button variant="outline" size="sm" onClick={fetchInvoice} disabled={loading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.text}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
        </div>
      )}

      {!loading && invoice && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Invoice card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-zinc-400" />
                  Invoice Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Field label="Invoice ID">
                  <span className="font-mono text-xs text-zinc-400">{invoice.id}</span>
                </Field>
                <Field label="Status">
                  <StatusPill status={invoice.status} />
                </Field>
                <Field label="Amount">
                  <span className="font-semibold">{formatCurrency(invoice.amount, invoice.currency)}</span>
                  <span className="ml-1 text-xs text-zinc-400">{invoice.currency}</span>
                </Field>
                <Field label="Pricing Tier">{invoice.pricingTier.name}</Field>
                <Field label="Fee Type">
                  <span className="capitalize">{invoice.pricingTier.feeType.replace(/_/g, " ")}</span>
                </Field>
                <Field label="Payment Method">
                  <span className="capitalize">{invoice.paymentMethod ?? "—"}</span>
                </Field>
                <Field label="Paid At">
                  {invoice.paidAt
                    ? new Date(invoice.paidAt).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </Field>
                <Field label="Created">
                  {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Field>
                {invoice.externalTransactionId && (
                  <Field label="Transaction ID">
                    <span className="font-mono text-xs text-zinc-400">{invoice.externalTransactionId}</span>
                  </Field>
                )}
                {invoice.externalIntentId && (
                  <Field label="Intent ID">
                    <span className="font-mono text-xs text-zinc-400">{invoice.externalIntentId}</span>
                  </Field>
                )}
              </CardContent>
            </Card>

            {/* Participant card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-zinc-400" />
                  Participant
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Field label="Full Name">{invoice.participant.fullName}</Field>
                <Field label="Email">
                  <span className="font-mono text-sm">{invoice.participant.email ?? "—"}</span>
                </Field>
                <Field label="Participant ID">
                  <span className="font-mono text-xs text-zinc-400">{invoice.participant.id}</span>
                </Field>
                <div className="pt-2">
                  <Link
                    href={`/programs/${programId}/users/${invoice.participant.userId}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View User Account
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Go service transaction card */}
            {txn && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-zinc-400" />
                    Payment Transaction
                    {txnStatus && (
                      <span className="ml-auto">
                        <StatusPill status={txnStatus} />
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.entries(txn)
                    .filter(([k]) => !["id"].includes(k))
                    .map(([key, val]) => (
                      <Field key={key} label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}>
                        {val === null || val === undefined || val === ""
                          ? "—"
                          : String(val)}
                      </Field>
                    ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Actions sidebar */}
          <div className="space-y-4">
            {needsReview && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Verify Payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    This payment has been submitted for manual verification. Review the proof and approve or reject.
                  </p>
                  <div>
                    <label className="text-xs font-medium text-zinc-600 mb-1 block">
                      Reason (optional)
                    </label>
                    <textarea
                      className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      placeholder="Add a note…"
                      value={verifyReason}
                      onChange={(e) => setVerifyReason(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    disabled={verifyLoading}
                    onClick={() => { setVerifyAction("approve"); setConfirmOpen(true); }}
                  >
                    {verifyLoading && verifyAction === "approve" ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                    )}
                    Approve Payment
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    disabled={verifyLoading}
                    onClick={() => { setVerifyAction("reject"); setConfirmOpen(true); }}
                  >
                    {verifyLoading && verifyAction === "reject" ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldX className="mr-2 h-3.5 w-3.5" />
                    )}
                    Reject Payment
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status</span>
                  <StatusPill status={invoice.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Amount</span>
                  <span className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tier</span>
                  <span className="text-zinc-700">{invoice.pricingTier.name}</span>
                </div>
                {txnStatus && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Txn Status</span>
                    <StatusPill status={txnStatus} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={verifyAction === "approve" ? "Approve Payment" : "Reject Payment"}
        description={
          verifyAction === "approve"
            ? "Confirm approval of this manual payment? This will mark it as paid."
            : "Confirm rejection of this payment? The participant will be notified."
        }
        confirmLabel={verifyAction === "approve" ? "Approve" : "Reject"}
        variant={verifyAction === "approve" ? "default" : "destructive"}
        onConfirm={handleVerify}
      />
    </div>
  );
}
