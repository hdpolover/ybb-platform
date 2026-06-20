"use client";

import { use } from "react";
import { FullyFundedParticipantsAll } from "@/app/components/scoring/FullyFundedParticipantsAll";

export default function FullyFundedScoringPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Fully Funded Participants</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage all fully funded participants for this program
        </p>
      </div>

      <FullyFundedParticipantsAll programId={programId} />
    </div>
  );
}
