"use client";

import { use } from "react";
import { DocumentReviewQueue } from "@/app/components/submissions/DocumentReviewQueue";

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
          Review signed agreement letters uploaded by participants: view the file, then approve, decline, or
          request a revision.
        </p>
      </div>

      <DocumentReviewQueue programId={programId} />
    </div>
  );
}
