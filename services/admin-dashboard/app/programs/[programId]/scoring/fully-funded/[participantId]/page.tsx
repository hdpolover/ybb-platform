"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApplication, exportApplicationsExcel, type Application } from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { useApplicationQueue } from "@/app/hooks/useApplicationQueue";
import { FullyFundedHeaderCard } from "@/app/components/scoring/FullyFundedHeaderCard";
import { FullyFundedDetailsTabsCard } from "@/app/components/scoring/FullyFundedDetailsTabsCard";
import { ScoringPanel } from "@/app/components/scoring/ScoringPanel";
import { MobileScoringDock } from "@/app/components/scoring/MobileScoringDock";
import { ApplicationQueueBar } from "@/app/components/scoring/ApplicationQueueBar";
import { KeyboardShortcutsHelp } from "@/app/components/scoring/KeyboardShortcutsHelp";
import { parseStage, type Stage } from "@/app/components/scoring/stage";
import type { AssessmentFormHandle } from "@/app/components/scoring/AssessmentForm";
import { EmptyState } from "@/src/admin/empty-state";

/** Any editable element -- score inputs, the notes textarea, the override-
 *  reason input, or any future text field. Global queue shortcuts (Shift+
 *  arrows, "?") must never fire while focus is here; only Cmd/Ctrl+Enter is
 *  allowed to fire everywhere, since it's a distinct combo from plain Enter
 *  and doesn't collide with typing. */
function isTypingTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT" || tag === "INPUT") return true;
  return el.isContentEditable;
}

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

  // ─── Review queue: Previous/Next across the same filtered list the
  // reviewer was looking at in the table, plus the keyboard-driven flow on
  // top of it. See app/hooks/useApplicationQueue.ts for how paging works.
  const [desktopDirty, setDesktopDirty] = useState(false);
  const [mobileDirty, setMobileDirty] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [endOfQueue, setEndOfQueue] = useState(false);
  const desktopFormRef = useRef<AssessmentFormHandle>(null);

  // There is no autosave: if either mounted AssessmentForm instance (desktop
  // dock or mobile sheet) has edits that were never saved, warn before
  // Previous/Next discards them by navigating to a different applicant.
  const confirmNavigate = useCallback(() => {
    if (!desktopDirty && !mobileDirty) return true;
    return window.confirm(
      "You have unsaved scoring changes for this applicant. Leave without saving?",
    );
  }, [desktopDirty, mobileDirty]);

  const queue = useApplicationQueue({
    resolvedProgramId,
    currentApplicationId: participantId,
    confirmNavigate,
  });

  // A fresh applicant is now open -- any earlier "end of queue" state is stale.
  useEffect(() => {
    setEndOfQueue(false);
  }, [participantId]);

  const handleSubmitSuccess = useCallback(() => {
    if (queue.hasNext) {
      // skipConfirm: a submit that just succeeded has nothing unsaved left
      // to warn about, even though the dirty-flag state above hasn't
      // re-rendered from its post-save effect yet.
      queue.goToNext({ skipConfirm: true });
    } else {
      setEndOfQueue(true);
    }
  }, [queue]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+Enter / Ctrl+Enter: submit and advance, from anywhere on the
      // page -- including while focus is in a text field, since it's a
      // distinct combo from plain Enter and doesn't collide with typing.
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        desktopFormRef.current?.submitIfReady();
        return;
      }

      if (helpOpen) return;
      if (isTypingTarget(document.activeElement)) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        queue.goToNext();
        return;
      }

      if (e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        queue.goToPrev();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [helpOpen, queue]);

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
      <ApplicationQueueBar
        applicantName={p?.fullName ?? "Unknown"}
        scoreStatus={application.scoreStatus}
        position={queue.position}
        total={queue.total}
        loading={queue.loading}
        hasPrev={queue.hasPrev}
        hasNext={queue.hasNext}
        navigating={queue.navigating}
        onPrev={() => queue.goToPrev()}
        onNext={() => queue.goToNext()}
        onOpenHelp={() => setHelpOpen(true)}
      />

      {endOfQueue && (
        <EmptyState
          title="End of queue"
          description="This was the last applicant matching your current filters. Adjust the filters or head back to the list for more."
        />
      )}

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
              ref={desktopFormRef}
              applicationId={participantId}
              stage={stage}
              onStageChange={handleStageChange}
              className="min-h-0 flex-1"
              onSubmitSuccess={handleSubmitSuccess}
              onDirtyChange={setDesktopDirty}
            />
          </div>
        </div>
      </div>

      <MobileScoringDock
        applicationId={participantId}
        stage={stage}
        onStageChange={handleStageChange}
        onSubmitSuccess={handleSubmitSuccess}
        onDirtyChange={setMobileDirty}
      />

      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
