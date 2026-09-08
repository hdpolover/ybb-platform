import * as React from "react";
import { Badge, type BadgeProps } from "@/src/ui/badge";

// Application/submission status
const applicationStatusMap: Record<string, BadgeProps["variant"]> = {
  draft: "secondary",
  submitted: "info",
  under_review: "pending",
  accepted: "success",
  rejected: "destructive",
  waitlisted: "warning",
  withdrawn: "secondary",
};

// Payment status
const paymentStatusMap: Record<string, BadgeProps["variant"]> = {
  pending: "pending",
  processing: "info",
  success: "success",
  succeeded: "success",
  failed: "destructive",
  canceled: "secondary",
  refunded: "warning",
  requires_payment_method: "warning",
};

// Readiness rule status
const readinessStatusMap: Record<string, BadgeProps["variant"]> = {
  pass: "success",
  fail: "destructive",
  overridden: "warning",
  unknown: "secondary",
};

// Generic status map fallback
const genericStatusMap: Record<string, BadgeProps["variant"]> = {
  active: "success",
  inactive: "secondary",
  open: "success",
  closed: "destructive",
  upcoming: "info",
  ongoing: "warning",
  completed: "success",
  archived: "secondary",
  published: "success",
  draft: "secondary",
};

function normalizeLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusBadgeProps {
  status: string;
  context?: "application" | "payment" | "readiness" | "generic";
  label?: string;
  className?: string;
}

export function StatusBadge({ status, context = "generic", label, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  const variant =
    context === "application"
      ? (applicationStatusMap[normalized] ?? "secondary")
      : context === "payment"
        ? (paymentStatusMap[normalized] ?? "secondary")
        : context === "readiness"
          ? (readinessStatusMap[normalized] ?? "secondary")
          : (genericStatusMap[normalized] ?? "secondary");

  return (
    <Badge variant={variant} className={className}>
      {label ?? normalizeLabel(status)}
    </Badge>
  );
}
