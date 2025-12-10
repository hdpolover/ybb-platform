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
    <div className="flex h-full flex-col gap-4">
      <AmbassadorsHeader />
      <div className="flex-1 min-h-0">
        <div className="h-full overflow-y-auto">
          <AmbassadorsTable />
        </div>
      </div>
    </div>
  );
}
