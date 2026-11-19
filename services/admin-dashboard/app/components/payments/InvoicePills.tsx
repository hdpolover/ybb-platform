// services/admin-dashboard/app/components/payments/InvoicePills.tsx
import React from "react";
import type { InvoiceListItem, InvoiceStatus } from "@/src/shared/api-client";
import { FOLLOW_UP_CLASS, INVOICE_STATUS_CLASS, NEUTRAL_PILL_CLASS, formatFollowUpLabel } from "@/lib/invoice-badges";

export function InvoiceStatusPill({ status }: { status: string }) {
  const cls = INVOICE_STATUS_CLASS[status as InvoiceStatus] ?? NEUTRAL_PILL_CLASS;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

export function FollowUpPill({ status }: { status: InvoiceListItem["followUpStatus"] }) {
  if (!status) return null;
  const cls = FOLLOW_UP_CLASS[status] ?? NEUTRAL_PILL_CLASS;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {formatFollowUpLabel(status)}
    </span>
  );
}
