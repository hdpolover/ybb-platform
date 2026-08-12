"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getApplication, exportApplicationsExcel, type Application } from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { FullyFundedHeaderCard } from "@/app/components/scoring/FullyFundedHeaderCard";
import { FullyFundedDetailsTabsCard } from "@/app/components/scoring/FullyFundedDetailsTabsCard";
import { ScoringPanel } from "@/app/components/scoring/ScoringPanel";
import { MobileScoringDock } from "@/app/components/scoring/MobileScoringDock";
import { parseStage, type Stage } from "@/app/components/scoring/stage";

export default function FullyFundedParticipantDetailPage() {
  const params = useParams();
  const participantId = (params?.participantId as string) || "";
  const programId = (params?.programId as string) || "";

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stage = parseStage(searchParams.get("stage"));

  function handleStageChange(nextStage: Stage) {
    // Pushed (not replaced) so browser back steps between stages, matching
    // the dedicated review route's behavior this page now replaces.
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("stage", nextStage);
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useResolvedProgramId(programId);
  const resolvedBrandId = useMemo(() => {
    return (
      accessiblePrograms.find(
        (p) => p.programId === resolvedProgramId || p.programSlug === programId
      )?.brandId ?? ""
    );
  }, [accessiblePrograms, resolvedProgramId, programId]);

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!participantId) return;
    setLoading(true);
    setNotFound(false);
    getApplication(participantId)
      .then((data) => {
        setApplication(data);
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes("404")) {
          setNotFound(true);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [participantId]);

  const handleExport = async () => {
    if (exporting || !resolvedBrandId) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportApplicationsExcel({
        brandId: resolvedBrandId,
        programId: resolvedProgramId,
        category: "fully_funded",
        search: application?.participant?.fullName,
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
        Loading participant data...
      </div>
    );
  }

  if (notFound || !application) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
        Participant not found.
      </div>
    );
  }

  const p = application.participant;
  const phone = [p?.phoneCountryCode, p?.phoneNumber].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <FullyFundedHeaderCard
        participantId={participantId}
        fullName={p?.fullName ?? "Unknown"}
        fundingPath={
          application.applicationCategory === "fully_funded"
            ? "Fully Funded"
            : application.applicationCategory
        }
        email={p?.email ?? ""}
        phone={phone || "Not provided"}
        nationality={p?.nationality ?? ""}
        gender={p?.gender ?? ""}
        institution={p?.institution ?? ""}
        onExportData={handleExport}
        exporting={exporting}
      />
      {exportError && (
        <p className="text-xs text-red-600">{exportError}</p>
      )}

      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="min-w-0 lg:flex-1">
          <FullyFundedDetailsTabsCard application={application} />
        </div>

        {/* Docked scoring panel: sticky alongside the tabs card on large
            screens, so a reviewer can read the essay and score it without
            leaving the page. Below lg it collapses into MobileScoringDock. */}
        <div className="hidden lg:block lg:w-[400px] lg:shrink-0">
          <div className="lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:flex-col lg:rounded-xl lg:border lg:border-zinc-200 lg:bg-white lg:p-5 lg:shadow-sm">
            <ScoringPanel
              applicationId={participantId}
              stage={stage}
              onStageChange={handleStageChange}
              className="min-h-0 flex-1"
            />
          </div>
        </div>
      </div>

      <MobileScoringDock
        applicationId={participantId}
        stage={stage}
        onStageChange={handleStageChange}
      />
    </div>
  );
}
