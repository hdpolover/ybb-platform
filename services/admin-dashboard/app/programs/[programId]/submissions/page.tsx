"use client";

import { use } from "react";

export default function SubmissionsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-zinc-900">Submissions</h1>
      <p className="text-sm text-zinc-600">
        Manage essay and agreement letter submissions for this program.
      </p>
    </div>
  );
}
