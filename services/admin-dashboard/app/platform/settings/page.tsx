"use client";

import Link from "next/link";
import { Settings, ShieldCheck, Building2, Globe } from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Centralized settings for platform-level administration and secure support operations."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/platform/support-access"
          className="group rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Support Access</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Configure support secret and impersonation guardrails for participant verification.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/platform/brands"
          className="group rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-zinc-100 p-2.5 text-zinc-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Brand Settings</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Manage brand-level profiles, finance settings, and identity content.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/platform/settings/platform-content"
          className="group rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Platform Content</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Organisation-wide impact stats shared across every brand&apos;s landing page.
              </p>
            </div>
          </div>
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="mb-2 flex items-center gap-2 text-zinc-700">
          <Settings className="h-4 w-4" />
          <p className="text-sm font-semibold">Navigation</p>
        </div>
        <p className="text-sm text-zinc-600">
          You can open support access directly from the sidebar under <span className="font-medium">Settings → Support Access</span>.
        </p>
      </div>
    </div>
  );
}
