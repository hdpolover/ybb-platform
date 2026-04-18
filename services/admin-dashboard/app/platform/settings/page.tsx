"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Brand-level settings are managed within each brand’s admin workspace."
      />
      <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
          <Settings className="h-7 w-7 text-zinc-500" />
        </div>
        <h2 className="mb-2 text-base font-semibold text-zinc-900">Brand Settings Not Available Here</h2>
        <p className="mb-6 max-w-sm text-sm text-zinc-500">
          Brand-specific settings such as general info, contact details, and finance configuration
          are managed by brand admins within each brand’s workspace.
        </p>
        <Link
          href="/platform/brands"
          className="inline-flex items-center gap-2 rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900"
        >
          Go to Brands
        </Link>
      </div>
    </div>
  );
}