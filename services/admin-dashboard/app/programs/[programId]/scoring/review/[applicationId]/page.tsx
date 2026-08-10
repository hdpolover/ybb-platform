// services/admin-dashboard/app/programs/[programId]/scoring/review/[applicationId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { getApplication, ApiError, type Application } from "@/src/shared/api-client";
import { AssessmentForm } from "@/app/components/scoring/AssessmentForm";

const STAGES = ["application", "interview"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABELS: Record<Stage, string> = {
  application: "Application",
  interview: "Interview",
};

function parseStage(raw: string | null): Stage {
  return raw === "interview" ? "interview" : "application";
}

export default function ApplicationReviewPage() {
  const params = useParams<{ programId: string; applicationId: string }>();
  const applicationId = (params?.applicationId as string) || "";

  // The review endpoints only need applicationId/stage, not the program id,
  // so no program id lookup happens here. Add useResolvedProgramId(programId)
  // back if a program-scoped call (e.g. a "back to program" link) is needed later.

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stage = parseStage(searchParams.get("stage"));

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!applicationId) return;

    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await getApplication(applicationId);
        setApplication(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [applicationId]);

  function handleStageChange(nextStage: Stage) {
    // Pushed (not replaced) so browser back steps between stages, as required
    // by manual verification; a plain replace would skip past this page on back.
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("stage", nextStage);
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
        Loading application...
      </div>
    );
  }

  if (notFound || !application) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
        Application not found.
      </div>
    );
  }

  const fullName = application.participant?.fullName ?? "Unknown";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">{fullName}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 border border-emerald-100">
            {application.applicationCategory === "fully_funded"
              ? "Fully Funded"
              : application.applicationCategory}
          </span>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 border border-blue-100">
            {application.status}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex gap-2 border-b">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStageChange(s)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                stage === s
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {STAGE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <AssessmentForm applicationId={applicationId} stage={stage} />
        </div>
      </section>
    </div>
  );
}
