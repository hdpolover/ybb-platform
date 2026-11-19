// services/admin-dashboard/src/admin/components/public-card-shell.tsx
import type { ReactNode } from "react";

/** Centered card for the pages that work without a session (request access, set password). */
export function PublicCardShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-8 sm:items-center sm:py-12">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-700">Youth Break the Boundaries</p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-zinc-600">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
