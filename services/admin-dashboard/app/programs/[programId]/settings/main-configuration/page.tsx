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

  // The result carries the program id it was fetched for, so "loading" is
  // derived from that id no longer matching the one being shown rather than
  // held as its own flag. Setting a loading flag synchronously inside the
  // effect is what react-hooks/set-state-in-effect rejects, and the key also
  // does the stale-response guarding the flag used to need a `cancelled`
  // latch for.
  const [readinessResult, setReadinessResult] = useState<{
    programId: string;
    report: ReadinessReport | null;
    error: string | null;
  } | null>(null);

  // accessiblePrograms loads asynchronously, so resolvedProgramId can still be
  // the raw slug on the first render. Wait for auth to settle before firing;
  // until a result lands for the current id the panel keeps its loading
  // affordance instead of falling through to the empty state.
  const readinessLoading = readinessResult?.programId !== resolvedProgramId;

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    getProgramReadiness(resolvedProgramId)
      .then((data) => {
        if (!cancelled) setReadinessResult({ programId: resolvedProgramId, report: data, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setReadinessResult({
            programId: resolvedProgramId,
            report: null,
            error: err instanceof Error ? err.message : "Failed to load readiness.",
          });
        }
      });
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
        ) : readinessResult?.error ? (
          <p className="text-sm text-red-700">{readinessResult.error}</p>
        ) : (
          <ReadinessList results={readinessResult?.report?.results ?? []} />
        )}
      </Card>
    </div>
  );
}
