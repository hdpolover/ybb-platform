"use client";

import { use } from "react";
import { UserPlusIcon } from "@heroicons/react/24/outline";

export default function AmbassadorsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Ambassadors</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage program ambassadors and their activities
        </p>
      </div>

      {/* Placeholder Content */}
      <div className="rounded-lg border border-zinc-200 bg-white p-12">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <UserPlusIcon className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-zinc-900">
            Ambassadors Management
          </h3>
          <p className="mt-2 text-sm text-zinc-600">
            Ambassador list and management features coming soon
          </p>
          <p className="mt-1 text-xs text-zinc-500">Program ID: {programId}</p>
        </div>
      </div>
    </div>
  );
}
