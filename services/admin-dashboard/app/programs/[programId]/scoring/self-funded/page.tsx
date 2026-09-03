// services/admin-dashboard/app/programs/[programId]/scoring/self-funded/page.tsx
"use client";

import { use } from "react";
import { FullyFundedParticipantsAll } from "@/app/components/scoring/FullyFundedParticipantsAll";
import { ScoringCategoryTabs } from "@/app/components/scoring/ScoringCategoryTabs";

// Self-funded applicants aren't reviewed for scoring, but this tab lets
// reviewers spot people who registered self-funded by mistake — reuses the
// same list component as the fully-funded queue with a different category.
export default function SelfFundedScoringPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Self Funded Participants</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Spot-check self funded registrations for this program
        </p>
      </div>

      <ScoringCategoryTabs programId={programId} active="self_funded" />
      <FullyFundedParticipantsAll programId={programId} category="self_funded" />
    </div>
  );
}
