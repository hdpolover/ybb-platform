"use client";

import { use } from "react";
import { PaymentsSummary } from "../../../components/payments/PaymentsSummary";

export default function PaymentsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  return <PaymentsSummary selectedProgramId={programId} />;
}
