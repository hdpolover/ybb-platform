"use client";

import { use } from "react";
import { ParticipantsHeader } from "@/app/components/users/ParticipantsHeader";
import { ParticipantsTable } from "@/app/components/users/ParticipantsTable";

export default function ParticipantsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div className="space-y-4">
      <ParticipantsHeader />
      <ParticipantsTable />
    </div>
  );
}

