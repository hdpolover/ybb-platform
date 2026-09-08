"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { MainConfigurationSettings } from "@/app/components/settings/MainConfigurationSettings";
import { Card } from "@/src/ui/card";
import { ReadinessList } from "@/src/admin/readiness-list";
import { getProgramReadiness, type ReadinessReport } from "@/src/shared/api-client";

export default function MainConfigurationPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms, isLoading: authLoading } = useAuth();
  const programName =
    accessiblePrograms.find((program) => program.programId === programId)?.programName ??
    "Selected Program";

  // Route params for program pages are frequently a slug, not the UUID the
  // readiness endpoint expects (it 400s on anything ParseUUIDPipe rejects).
  // Resolve to the canonical id the same way MainConfigurationSettings does.
  const resolvedProgramId = useResolvedProgramId(programId);

  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  useEffect(() => {
    // accessiblePrograms loads asynchronously, so resolvedProgramId can still
    // be the raw slug on the first render. Wait for auth to settle before
    // firing, and only ever apply the response matching the id currently in
    // flight so a slow, now-stale request can't clobber a newer one. Leaving
    // readinessLoading untouched here keeps the panel showing its loading
    // affordance instead of the empty state while auth is still settling.
    if (authLoading) return;

    let cancelled = false;
    setReadinessLoading(true);
    getProgramReadiness(resolvedProgramId)
      .then((data) => { if (!cancelled) { setReadiness(data); setReadinessError(null); } })
      .catch((err) => {
        if (!cancelled) setReadinessError(err instanceof Error ? err.message : "Failed to load readiness.");
      })
      .finally(() => { if (!cancelled) setReadinessLoading(false); });
    return () => { cancelled = true; };
  }, [resolvedProgramId, authLoading]);

  return (
    <div className="space-y-6">
      <MainConfigurationSettings programId={programId} programName={programName} />

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Publish readiness</h2>
        {readinessLoading ? (
          <div className="rounded-md border border-zinc-200 bg-white px-5 py-8 text-center text-xs text-zinc-400 shadow-sm">
            Loading readiness…
          </div>
        ) : readinessError ? (
          <p className="text-sm text-red-700">{readinessError}</p>
        ) : (
          <ReadinessList results={readiness?.results ?? []} />
        )}
      </Card>
    </div>
  );
}
