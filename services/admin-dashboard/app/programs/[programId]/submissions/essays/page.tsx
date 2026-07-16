"use client";

import { use } from "react";
import { EssaysHeader } from "@/app/components/submissions/EssaysHeader";
import { EssaysTable } from "@/app/components/submissions/EssaysTable";

export default function EssaysPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div className="space-y-4">
      <EssaysHeader />
      <EssaysTable />
    </div>
  );
}
