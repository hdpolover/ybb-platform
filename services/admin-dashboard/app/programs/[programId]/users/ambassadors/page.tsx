"use client";

import { use } from "react";
import { AmbassadorsHeader } from "@/app/components/users/AmbassadorsHeader";
import { AmbassadorsTable } from "@/app/components/users/AmbassadorsTable";

export default function AmbassadorsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div className="space-y-4">
      <AmbassadorsHeader />
      <AmbassadorsTable />
    </div>
  );
}
