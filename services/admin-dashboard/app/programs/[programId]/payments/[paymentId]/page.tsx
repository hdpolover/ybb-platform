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
  ExternalLink,
} from "lucide-react";
import {
  getProgramInvoice,
  updateProgramInvoiceStatus,
  verifyInvoice,
  submitApplication,
  downloadInvoiceProof,
  type InvoiceDetail,
  type InvoiceStatus,
} from "@/src/shared/api-client";
import { toast as sonnerToast } from "sonner";
import { PageHeader } from "@/src/admin/page-header";
import { Button } from "@/src/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/utils";
import { NotifyParticipantButton } from "@/app/components/payments/details/NotifyParticipantButton";

const STATUS_CLASS: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300",
  refunded: "bg-purple-50 text-purple-700 border-purple-200",
  pending: "bg-blue-50 text-blue-700 border-blue-200",
  needs_review: "bg-orange-50 text-orange-700 border-orange-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  void: "bg-zinc-100 text-zinc-700 border-zinc-300",
};

const FOLLOW_UP_CLASS: Record<string, string> = {
  participant_cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300",
  payment_cancelled_issue: "bg-rose-50 text-rose-700 border-rose-200",
  payment_failed: "bg-red-50 text-red-700 border-red-200",
  manual_proof_rejected: "bg-orange-50 text-orange-700 border-orange-200",
};

function StatusPill({ status }: { status: string }) {
  const normalizedStatus = status.trim().toLowerCase();
  const cls = STATUS_CLASS[normalizedStatus] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {formatKeyLabel(normalizedStatus)}
    </span>
  );
}

function FollowUpPill({ status }: { status: InvoiceDetail["followUpStatus"] }) {
  if (!status) return null;
  const cls = FOLLOW_UP_CLASS[status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {formatKeyLabel(status)}
    </span>
  );
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatKeyLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
  const [detailModal, setDetailModal] = useState<{ key: string; value: unknown } | null>(null);
  const [manualStatus, setManualStatus] = useState<InvoiceStatus>("processing");
  const [manualReason, setManualReason] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);

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

  const txn = invoice?.transaction as Record<string, unknown> | null | undefined;
  const txnStatus = txn?.status as string | undefined;
  const attempts = invoice?.transactions ?? [];
  const needsReview = txnStatus === "NEEDS_REVIEW";
  const paymentMethodValue = formatPaymentMethod(invoice?.paymentMethod ?? null);
  const proofUrl = extractProofUrl(txn) ?? attempts.map((attempt) => extractProofUrl(attempt)).find(Boolean) ?? null;
  const isManualTransfer = isManualTransferPayment(invoice?.paymentMethod ?? null, txn);
  const showPaymentControls = Boolean(invoice);
  // Gate the payment-help email on genuine payment problems: failed/processing
  // invoices always qualify; a cancelled invoice only qualifies when the
  // follow-up status marks it as an issue-driven cancellation, not a
  // participant's own choice to cancel.
  const isProblemInvoice = Boolean(
    invoice &&
      (invoice.status === "failed" ||
        invoice.status === "processing" ||
        (invoice.status === "cancelled" && invoice.followUpStatus === "payment_cancelled_issue")),
  );
  const looksLikeInvoiceId =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      paymentId,
    );

  useEffect(() => {
    if (invoice?.status) {
      setManualStatus(invoice.status);
    }
  }, [invoice?.status]);

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
          <div className="font-medium">{error}</div>
          <div className="mt-1 text-xs text-red-600/80">
            Invoice id: <code className="font-mono">{paymentId}</code>
            {!looksLikeInvoiceId &&
              " — this link looks malformed (not a valid invoice id)."}
          </div>
          <Link
            href={`/programs/${programId}/payments`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700 underline hover:text-red-800"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Payments
          </Link>
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
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Status</p>
                <div className="mt-2">
                  <StatusPill status={invoice.status} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Amount</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">
                  {formatCurrency(invoice.amount, invoice.currency)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Payment Method</p>
                <p className="mt-2 text-base font-medium text-zinc-900">{paymentMethodValue}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Pricing Tier</p>
                <p className="mt-2 text-base font-medium text-zinc-900">{invoice.pricingTier.name}</p>
                <p className="text-xs text-zinc-500 capitalize">{invoice.pricingTier.feeType.replace(/_/g, " ")}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-8">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-zinc-400" />
                      Invoice Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm md:grid-cols-2">
                      <div>
                        <dt className="text-zinc-500">Invoice ID</dt>
                        <dd className="font-mono text-xs text-zinc-700 break-all">{invoice.id}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Created</dt>
                        <dd className="text-zinc-900">
                          {formatDate(invoice.createdAt, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Paid At</dt>
                        <dd className="text-zinc-900">
                          {invoice.paidAt
                            ? formatDateTime(invoice.paidAt, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Currency</dt>
                        <dd className="text-zinc-900">{invoice.currency}</dd>
                      </div>
                      {invoice.externalTransactionId && (
                        <div>
                          <dt className="text-zinc-500">Transaction ID</dt>
                          <dd className="font-mono text-xs text-zinc-700 break-all">{invoice.externalTransactionId}</dd>
                        </div>
                      )}
                      {invoice.externalIntentId && (
                        <div>
                          <dt className="text-zinc-500">Intent ID</dt>
                          <dd className="font-mono text-xs text-zinc-700 break-all">{invoice.externalIntentId}</dd>
                        </div>
                      )}
                    </dl>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-zinc-400" />
                      Participant
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-1 gap-y-4 text-sm">
                      <div>
                        <dt className="text-zinc-500">Full Name</dt>
                        <dd className="text-zinc-900">{invoice.participant.fullName}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Email</dt>
                        <dd className="font-mono text-zinc-900 break-all">{invoice.participant.email ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Participant ID</dt>
                        <dd className="font-mono text-xs text-zinc-700 break-all">{invoice.participant.id}</dd>
                      </div>
                      {invoice.participant.ambassador && (
                        <div>
                          <dt className="text-zinc-500">Ambassador</dt>
                          <dd className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
                                invoice.participant.ambassador.isActive
                                  ? invoice.participant.ambassador.isSameProgram
                                    ? "bg-violet-50 text-violet-700 border-violet-200"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : "bg-zinc-100 text-zinc-500 border-zinc-200"
                              }`}
                            >
                              {invoice.participant.ambassador.isSameProgram
                                ? "This program"
                                : "Other program"}
                            </span>
                            <span className="font-mono text-xs text-zinc-700">
                              {invoice.participant.ambassador.referralCode}
                            </span>
                            {!invoice.participant.ambassador.isActive && (
                              <span className="text-xs text-zinc-400">(inactive)</span>
                            )}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <div className="pt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/programs/${programId}/users/${invoice.participant.userId}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View User Account
                      </Link>
                      <Link
                        href={`/programs/${programId}/participants/${invoice.participant.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                      >
                        View participant
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {(invoice.pricingTier.usdPrice !== null || invoice.pricingTier.idrPrice !== null) && (
                <PricingTierBreakdownCard
                  tierName={invoice.pricingTier.name}
                  feeType={invoice.pricingTier.feeType}
                  usdPrice={invoice.pricingTier.usdPrice}
                  idrPrice={invoice.pricingTier.idrPrice}
                  billedCurrency={invoice.currency}
                  billedAmount={invoice.amount}
                />
              )}

              {txn && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-zinc-400" />
                      Latest Payment Transaction
                      {txnStatus && (
                        <span className="ml-auto">
                          <StatusPill status={txnStatus} />
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm md:grid-cols-2 xl:grid-cols-3">
                      {Object.entries(txn)
                        // "payment_method_label" is dropped here: it restates the
                        // same invoice-level payment method already shown in the
                        // top stat card, with no additional context at this layer.
                        .filter(([k]) => !["id", "payment_method_label"].includes(k))
                        .map(([key, val]) => (
                          <div key={key}>
                            <dt className="text-zinc-500">{formatKeyLabel(key)}</dt>
                            <dd className="text-zinc-900 break-words">
                              {val === null || val === undefined || val === ""
                                ? "—"
                                : typeof val === "object"
                                  ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => setDetailModal({ key, value: val })}
                                    >
                                      See details
                                    </Button>
                                  )
                                  : String(val)}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </CardContent>
                </Card>
              )}

              {attempts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span>Payment Attempts</span>
                      <span className="text-sm font-normal text-zinc-500">{attempts.length} total</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {attempts.map((attempt, index) => {
                      const attemptStatus = getStringValue(attempt, "status");
                      const attemptMethod =
                        getStringValue(attempt, "payment_method_label") ??
                        getStringValue(attempt, "payment_method_id");
                      const attemptProofUrl = extractProofUrl(attempt);
                      const attemptGatewayResponse = getObjectValue(attempt, "gateway_response");
                      const attemptNumber = attempts.length - index;
                      const attemptId = getStringValue(attempt, "id");
                      const attemptGatewayReference = getStringValue(attempt, "gateway_reference_id");
                      // Gateway reference (external gateway's own order/txn id) and
                      // our internal transaction id are different fields in general,
                      // but for some gateways they end up identical per attempt —
                      // only collapse the display when this specific row's values match.
                      const gatewayReferenceMatchesId =
                        attemptId !== null && attemptGatewayReference !== null && attemptId === attemptGatewayReference;
                      return (
                        <div key={getStringValue(attempt, "id") ?? `${attemptNumber}-${index}`} className="rounded-lg border border-zinc-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-zinc-900">Attempt {attemptNumber}</p>
                                {index === 0 && (
                                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                                    Latest
                                  </span>
                                )}
                                {attemptStatus && <StatusPill status={attemptStatus} />}
                              </div>
                              <p className="mt-1 text-xs text-zinc-500">
                                Created {formatOptionalDateTime(getStringValue(attempt, "created_at"))}
                                {" · "}
                                Updated {formatOptionalDateTime(getStringValue(attempt, "updated_at"))}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {attemptGatewayResponse && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDetailModal({ key: `gateway_response_attempt_${attemptNumber}`, value: attemptGatewayResponse })}
                                >
                                  Gateway Response
                                </Button>
                              )}
                              {attemptProofUrl && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(attemptProofUrl, "_blank", "noopener,noreferrer")}
                                >
                                  Open Proof
                                </Button>
                              )}
                            </div>
                          </div>

                          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                            <div>
                              <dt className="text-zinc-500">Transaction ID</dt>
                              <dd className="font-mono text-xs text-zinc-800 break-all">
                                {getStringValue(attempt, "id") ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Method</dt>
                              <dd className="text-zinc-900">{formatPaymentMethod(attemptMethod ?? null)}</dd>
                            </div>
                            {!gatewayReferenceMatchesId && (
                              <div>
                                <dt className="text-zinc-500">Gateway Reference</dt>
                                <dd className="font-mono text-xs text-zinc-800 break-all">
                                  {attemptGatewayReference ?? "—"}
                                </dd>
                              </div>
                            )}
                            <div>
                              <dt className="text-zinc-500">Amount</dt>
                              <dd className="text-zinc-900">
                                {formatAttemptAmount(attempt, invoice.currency)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Error Code</dt>
                              <dd className="text-zinc-900">{getStringValue(attempt, "error_code") ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Reviewed At</dt>
                              <dd className="text-zinc-900">
                                {formatOptionalDateTime(getStringValue(attempt, "reviewed_at"))}
                              </dd>
                            </div>
                          </dl>

                          {getStringValue(attempt, "admin_notes") && (
                            <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                              <span className="font-medium text-zinc-800">Admin notes:</span>{" "}
                              {getStringValue(attempt, "admin_notes")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment Proof</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {proofUrl ? (
                    <>
                      {isImageUrl(proofUrl) ? (
                        <button
                          type="button"
                          onClick={() => setProofOpen(true)}
                          aria-label="View payment proof full size"
                          className="block w-full cursor-zoom-in overflow-hidden rounded-md border border-zinc-200 transition-colors hover:border-zinc-300"
                        >
                          <img src={proofUrl} alt="Payment proof" className="max-h-96 w-full object-contain bg-zinc-50" />
                        </button>
                      ) : (
                        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                          Payment proof file is available.
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            isImageUrl(proofUrl)
                              ? setProofOpen(true)
                              : window.open(proofUrl, "_blank", "noopener,noreferrer")
                          }
                        >
                          {isImageUrl(proofUrl) ? "View proof" : "Open proof"}
                        </Button>
                        {proofUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void downloadInvoiceProof(invoice.id)}
                          >
                            Download
                          </Button>
                        )}
                      </div>
                      {isImageUrl(proofUrl) && (
                        <Dialog open={proofOpen} onOpenChange={setProofOpen}>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Payment proof</DialogTitle>
                            </DialogHeader>
                            <img
                              src={proofUrl}
                              alt="Payment proof"
                              className="max-h-[80vh] w-full rounded-md object-contain bg-zinc-50"
                            />
                          </DialogContent>
                        </Dialog>
                      )}
                    </>
                  ) : (
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                      No payment proof found in gateway transaction payload.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 xl:col-span-4">
            {invoice.status === "paid" && invoice.application.status === "draft" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Application</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    Payment is confirmed. Submit this participant&apos;s application to move it from draft to submitted.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    disabled={submittingApplication}
                    onClick={async () => {
                      const confirmed = window.confirm("Submit this participant's application?");
                      if (!confirmed) return;
                      setSubmittingApplication(true);
                      try {
                        await submitApplication(invoice.applicationId, invoice.participant.id);
                        sonnerToast.success("Application submitted successfully.");
                        await fetchInvoice();
                      } catch (err) {
                        sonnerToast.error(err instanceof Error ? err.message : "Failed to submit application.");
                      } finally {
                        setSubmittingApplication(false);
                      }
                    }}
                  >
                    {submittingApplication ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Submit application
                  </Button>
                </CardContent>
              </Card>
            )}

            {showPaymentControls && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {isManualTransfer ? "Manual Transfer Review" : "Payment Controls"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    {isManualTransfer
                      ? "Update invoice status after checking transfer proof."
                      : needsReview
                        ? "This gateway transaction is waiting for admin review. You can verify it here or apply a manual override."
                        : "Use these controls when you need to sync or override the invoice status."}
                  </p>
                  {isProblemInvoice && invoice && (
                    <NotifyParticipantButton
                      email={invoice.participant.email ?? "the participant"}
                      invoiceId={invoice.id}
                    />
                  )}
                  {needsReview && invoice?.externalTransactionId ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={manualSaving || !invoice}
                        onClick={async () => {
                          if (!invoice) return;
                          setManualSaving(true);
                          setToast(null);
                          try {
                            await verifyInvoice(invoice.id, "approve", manualReason || undefined);
                            setToast({ text: "Gateway payment approved.", ok: true });
                            await fetchInvoice();
                          } catch (err) {
                            setToast({ text: err instanceof Error ? err.message : "Failed to approve payment", ok: false });
                          } finally {
                            setManualSaving(false);
                          }
                        }}
                      >
                        {manualSaving ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                        )}
                        Approve Payment
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={manualSaving || !invoice}
                        onClick={async () => {
                          if (!invoice) return;
                          setManualSaving(true);
                          setToast(null);
                          try {
                            await verifyInvoice(invoice.id, "reject", manualReason || undefined);
                            setToast({ text: "Gateway payment rejected.", ok: true });
                            await fetchInvoice();
                          } catch (err) {
                            setToast({ text: err instanceof Error ? err.message : "Failed to reject payment", ok: false });
                          } finally {
                            setManualSaving(false);
                          }
                        }}
                      >
                        {manualSaving ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                        )}
                        Reject Payment
                      </Button>
                    </div>
                  ) : null}
                  <div>
                    <label className="text-xs font-medium text-zinc-600 mb-1 block">
                      Status
                    </label>
                    <select
                      value={manualStatus}
                      onChange={(e) => setManualStatus(e.target.value as InvoiceStatus)}
                      className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="processing">Processing</option>
                      <option value="paid">Paid</option>
                      <option value="failed">Failed</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600 mb-1 block">
                      Reason (optional)
                    </label>
                    <textarea
                      className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      placeholder="Why this status change?"
                      value={manualReason}
                      onChange={(e) => setManualReason(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    disabled={manualSaving || !invoice}
                    onClick={async () => {
                      if (!invoice) return;
                      setManualSaving(true);
                      setToast(null);
                      try {
                        await updateProgramInvoiceStatus(invoice.id, manualStatus, manualReason || undefined);
                        setToast({ text: "Invoice status updated.", ok: true });
                        await fetchInvoice();
                      } catch (err) {
                        setToast({ text: err instanceof Error ? err.message : "Failed to update status", ok: false });
                      } finally {
                        setManualSaving(false);
                      }
                    }}
                  >
                    {manualSaving ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                    )}
                    Apply Status
                  </Button>
                  {needsReview && (
                    <p className="text-[11px] text-zinc-500">
                      Transaction is awaiting review in gateway flow.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {invoice.followUpStatus && (
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Follow-up</span>
                    <FollowUpPill status={invoice.followUpStatus} />
                  </div>
                )}
                {invoice.application.ticketStatus && (
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Ticket Type</span>
                    <span className="text-zinc-700">{formatKeyLabel(invoice.application.ticketStatus)}</span>
                  </div>
                )}
                {invoice.rejectionReason && (
                  <div className="space-y-1">
                    <span className="text-zinc-500">Reason</span>
                    <p className="text-zinc-700">{invoice.rejectionReason}</p>
                  </div>
                )}
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
        </div>
      )}

      {detailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">{formatKeyLabel(detailModal.key)}</h3>
                <p className="text-xs text-zinc-500">Gateway response details</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setDetailModal(null)}>
                Close
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              <pre className="whitespace-pre-wrap break-words rounded-md bg-zinc-50 p-3 text-xs text-zinc-800">
                {safeStringify(detailModal.value)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PricingTierBreakdownCard({
  tierName,
  feeType,
  usdPrice,
  idrPrice,
  billedCurrency,
  billedAmount,
}: {
  tierName: string;
  feeType: string;
  usdPrice: number | null;
  idrPrice: number | null;
  billedCurrency: string;
  billedAmount: number;
}) {
  const normalizedBilled = billedCurrency.trim().toUpperCase();
  const billedIsUsd = normalizedBilled === "USD";
  const billedIsIdr = normalizedBilled === "IDR";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-zinc-400" />
          Pricing Tier Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-900">{tierName}</p>
            <p className="text-xs text-zinc-500 capitalize">{feeType.replace(/_/g, " ")}</p>
          </div>
          <p className="text-xs text-zinc-500">
            Billed: <span className="font-medium text-zinc-700">{formatCurrency(billedAmount, billedCurrency)}</span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PriceRow
            label="Gateway price (USD)"
            sublabel="Stripe / PayPal"
            value={usdPrice !== null ? formatUsd(usdPrice) : null}
            highlighted={billedIsUsd}
          />
          <PriceRow
            label="Manual transfer (IDR)"
            sublabel="Bank transfer"
            value={idrPrice !== null ? formatIdr(idrPrice) : null}
            highlighted={billedIsIdr}
          />
        </div>

        {!billedIsUsd && !billedIsIdr && (
          <p className="text-[11px] text-zinc-500">
            Invoice currency ({normalizedBilled}) does not match either tier price; verify before paying out.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PriceRow({
  label,
  sublabel,
  value,
  highlighted,
}: {
  label: string;
  sublabel: string;
  value: string | null;
  highlighted: boolean;
}) {
  const baseClasses = "rounded-md border px-3 py-3 transition-colors";
  const stateClasses = highlighted
    ? "border-emerald-300 bg-emerald-50"
    : "border-zinc-200 bg-white";
  return (
    <div className={`${baseClasses} ${stateClasses}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        {highlighted && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Billed
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-semibold text-zinc-900">
        {value ?? <span className="text-zinc-400">Not set</span>}
      </p>
      <p className="text-[11px] text-zinc-500">{sublabel}</p>
    </div>
  );
}

function formatPaymentMethod(value: string | null): string {
  if (!value) return "Not recorded";
  const normalized = value.trim().toLowerCase();
  if (["unknown", "-", "n/a", "na", "null", "undefined"].includes(normalized)) {
    return "Not recorded";
  }
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractProofUrl(transaction: Record<string, unknown> | null | undefined): string | null {
  if (!transaction) return null;
  return findStringByKeysDeep(transaction, [
    "proof_file_url",
    "proofFileUrl",
    "proof_url",
    "proofUrl",
    "payment_proof_url",
    "paymentProofUrl",
    "receipt_url",
    "receiptUrl",
  ]);
}

function getStringValue(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function getObjectValue(source: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = source[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function formatOptionalDateTime(value: string | null): string {
  return value ? formatDateTime(value) : "—";
}

function formatAttemptAmount(attempt: Record<string, unknown>, fallbackCurrency: string): string {
  const amount =
    typeof attempt.amount_total === "number"
      ? attempt.amount_total
      : typeof attempt.amount === "number"
        ? attempt.amount
        : null;
  const currency = getStringValue(attempt, "currency") ?? fallbackCurrency;
  return amount === null ? "—" : formatCurrency(amount, currency);
}

function isManualTransferPayment(
  paymentMethod: string | null,
  transaction: Record<string, unknown> | null | undefined,
): boolean {
  const methodFromField = paymentMethod ?? "";
  const methodFromTransaction = findStringByKeysDeep(transaction ?? {}, [
    "payment_method_id",
    "paymentMethodId",
    "payment_method",
    "paymentMethod",
    "method",
    "method_name",
    "methodName",
  ]) ?? "";
  const token = `${methodFromField} ${methodFromTransaction}`.toLowerCase();
  return token.includes("manual") || token.includes("bank_transfer") || token.includes("manual_transfer");
}

function isImageUrl(value: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(value);
}

function findStringByKeysDeep(source: unknown, keys: string[], depth = 0): string | null {
  if (depth > 6 || source === null || source === undefined) return null;
  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findStringByKeysDeep(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof source !== "object") return null;

  const record = source as Record<string, unknown>;
  // Only return a value found under one of the requested keys.
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  // Recurse into nested objects/arrays only. Do NOT treat a bare nested string
  // as a match: doing so returned the first string field of the transaction
  // (an id, currency, gateway URL, etc.) for every invoice, which made the proof
  // panel and Download button appear even when no proof file was uploaded.
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const found = findStringByKeysDeep(value, keys, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
