"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { Badge } from "@/src/ui/badge";
import { LoaTemplateEditor } from "@/app/components/documents/LoaTemplateEditor";
import { LoaBatchesTab } from "@/app/components/documents/LoaBatchesTab";
import { LoaStatusTable } from "@/app/components/documents/LoaStatusTable";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  listDocumentTemplates,
  getLoaBatches,
  type DocumentTemplate,
  type LoaBatch,
} from "@/src/shared/api-client";

type TemplateStatus = "loading" | "published" | "draft" | "none";

export default function LoaTemplatePage() {
  const params = useParams<{ programId: string }>();
  const programId = params.programId;
  const resolvedProgramId = useResolvedProgramId(programId);

  // Template status — drives both the banner and the smart default tab.
  // `null` means "unknown yet" (still loading).
  const [templateExists, setTemplateExists] = useState<boolean | null>(null);
  const [hasActiveTemplate, setHasActiveTemplate] = useState<boolean | null>(null);

  // Batch counts for the banner.
  const [batchCount, setBatchCount] = useState<number | null>(null);
  const [releasedCount, setReleasedCount] = useState<number | null>(null);

  // Controlled tab so we can default to "template" when there's nothing
  // published yet, but only decide that once, on first data load.
  const [tab, setTab] = useState("batches");
  const tabDefaultSet = useRef(false);

  // Light fetch so the banner + default tab are correct even before the
  // admin opens the Template or Batches tab (those components mount lazily).
  useEffect(() => {
    if (!resolvedProgramId) return;
    listDocumentTemplates(resolvedProgramId, "letter_of_acceptance")
      .then((list) => {
        const t = list[0] ?? null;
        setTemplateExists(!!t);
        setHasActiveTemplate(!!t?.isActive);
        if (!tabDefaultSet.current) {
          tabDefaultSet.current = true;
          setTab(t?.isActive ? "batches" : "template");
        }
      })
      .catch(() => {
        // Non-fatal — the Template tab will surface its own load error.
      });
  }, [resolvedProgramId]);

  useEffect(() => {
    if (!resolvedProgramId) return;
    getLoaBatches(resolvedProgramId)
      .then((list) => {
        setBatchCount(list.length);
        setReleasedCount(list.filter((b) => !!b.releasedAt).length);
      })
      .catch(() => {
        // Non-fatal — the Batches tab will surface its own load error.
      });
  }, [resolvedProgramId]);

  // Keep the banner in sync with live edits made in either tab, without
  // waiting for a full page refetch.
  const handleTemplateChange = useCallback((t: DocumentTemplate | null) => {
    setTemplateExists(!!t);
    setHasActiveTemplate(!!t?.isActive);
  }, []);

  const handleBatchesChange = useCallback((list: LoaBatch[]) => {
    setBatchCount(list.length);
    setReleasedCount(list.filter((b) => !!b.releasedAt).length);
  }, []);

  const templateStatus: TemplateStatus =
    hasActiveTemplate === null
      ? "loading"
      : hasActiveTemplate
        ? "published"
        : templateExists
          ? "draft"
          : "none";

  const templateBadgeVariant =
    templateStatus === "published" ? "success" : templateStatus === "draft" ? "warning" : "secondary";
  const templateBadgeLabel =
    templateStatus === "loading"
      ? "Loading…"
      : templateStatus === "published"
        ? "Published"
        : templateStatus === "draft"
          ? "Draft"
          : "None";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invitation Letter"
        breadcrumb={
          <nav className="text-xs text-zinc-400">
            <span>Documents</span>
            <span className="mx-1">/</span>
            <span className="text-zinc-700">Invitation Letter</span>
          </nav>
        }
      />

      {/* Cross-tab status banner */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Template</span>
          <Badge variant={templateBadgeVariant}>{templateBadgeLabel}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Batches</span>
          <Badge variant={releasedCount ? "info" : "secondary"}>
            {batchCount === null ? "Loading…" : `${releasedCount ?? 0} of ${batchCount} released`}
          </Badge>
        </div>
        {templateStatus !== "loading" && templateStatus !== "published" && (
          <span className="flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Publish a template before releasing batches, participants cannot download without one.
          </span>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
        </TabsList>

        <TabsContent value="batches">
          <LoaBatchesTab
            programId={programId}
            hasActiveTemplate={hasActiveTemplate}
            onBatchesChange={handleBatchesChange}
          />
        </TabsContent>

        <TabsContent value="template">
          <LoaTemplateEditor programId={programId} onTemplateChange={handleTemplateChange} />
        </TabsContent>

        <TabsContent value="downloads">
          <LoaStatusTable programId={programId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
