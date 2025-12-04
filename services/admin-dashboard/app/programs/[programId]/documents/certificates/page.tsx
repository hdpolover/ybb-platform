"use client";

import { use } from "react";
import { CertificatesHeader } from "@/app/components/documents/CertificatesHeader";
import { CertificatesTable } from "@/app/components/documents/CertificatesTable";

export default function CertificatesPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div className="space-y-4">
      <CertificatesHeader />
      <CertificatesTable />
    </div>
  );
}
