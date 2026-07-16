"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";

export default function AmbassadorsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ambassadors"
        description="Ambassador management is handled within each program workspace."
      />
      <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <Users className="h-7 w-7 text-blue-500" />
        </div>
        <h2 className="mb-2 text-base font-semibold text-zinc-900">Feature Scoped to Program Level</h2>
        <p className="mb-6 max-w-sm text-sm text-zinc-500">
          Ambassadors are managed within each program’s workspace, not at the platform level.
          Open a program to manage its ambassador registrations and referrals.
        </p>
        <Link
          href="/platform/programs"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to Programs
        </Link>
      </div>
    </div>
  );
}