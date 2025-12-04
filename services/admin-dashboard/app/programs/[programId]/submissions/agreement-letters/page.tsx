"use client";

import { use } from "react";
import { AgreementLettersTable } from "@/app/components/submissions/AgreementLettersTable";

export default function AgreementLettersPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-zinc-900">Agreement Letters</h1>
        <p className="text-sm text-zinc-600">
          Track generation and signature status of agreement letters for confirmed participants in this program.
        </p>
      </div>

      <AgreementLettersTable />
    </div>
  );
}
