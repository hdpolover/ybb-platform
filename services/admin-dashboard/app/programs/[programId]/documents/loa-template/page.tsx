"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Eye, FileText, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import {
  getLoaStatus,
  listDocumentTemplates,
  type DocumentTemplate,
  type LoaStatusRow,
} from "@/src/shared/api-client";
import { PageHeader } from "@/src/admin/page-header";
import { StatCard } from "@/src/admin/stat-card";
import { LoaStatusTable } from "@/app/components/documents/LoaStatusTable";
import { LoaTemplateEditor } from "@/app/components/documents/LoaTemplateEditor";
import { GenerateLoaDialog } from "@/app/components/documents/GenerateLoaDialog";
import { LoaRecipientDrawer } from "@/app/components/documents/LoaRecipientDrawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";

export default function LoaTemplatePage() {
  const params = useParams<{ programId: string }>();
  const programId = params.programId;

  const [rows, setRows] = useState<LoaStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedRow, setSelectedRow] = useState<LoaStatusRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load active template on mount
  useEffect(() => {
    if (!programId) return;
    listDocumentTemplates(programId, "letter_of_acceptance")
      .then((tpls) => setActiveTemplate(tpls.find((t) => t.isActive) ?? tpls[0] ?? null))
      .catch(() => {
        /* silent — editor handles its own load */
      });
  }, [programId]);

  // Fetch LOA status rows — returns Promise<void> so callers can await it
  const fetchRows = useCallback(async (): Promise<void> => {
    if (!activeTemplate?.id) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getLoaStatus(programId, activeTemplate.id);
      setRows(data);
      // Sync any open drawer row so it reflects fresh data after a send
      setSelectedRow((prev) =>
        prev ? (data.find((r) => r.participantId === prev.participantId) ?? prev) : null,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load LoA status");
    } finally {
      setLoading(false);
    }
  }, [programId, activeTemplate?.id]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  // Funnel counts
  const eligible = rows.length;
  const generated = useMemo(() => rows.filter((r) => r.generatedAt != null).length, [rows]);
  const emailed = useMemo(() => rows.filter((r) => r.emailedAt != null).length, [rows]);
  const viewed = useMemo(() => rows.filter((r) => r.viewedAt != null).length, [rows]);

  const pctOfEligible = eligible > 0 ? Math.round((generated / eligible) * 100) : 0;
  const pctOfGenerated = generated > 0 ? Math.round((emailed / generated) * 100) : 0;
  const pctOfEmailed = emailed > 0 ? Math.round((viewed / emailed) * 100) : 0;

  function handleRowClick(row: LoaStatusRow) {
    setSelectedRow(row);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Letter of Acceptance"
        breadcrumb={
          <nav className="text-xs text-zinc-400">
            <span>Documents</span>
            <span className="mx-1">/</span>
            <span className="text-zinc-700">Letter of Acceptance</span>
          </nav>
        }
        actions={
          <GenerateLoaDialog
            templateId={activeTemplate?.id ?? null}
            programId={programId}
            onSuccess={fetchRows}
          />
        }
      />

      {/* Funnel stats — STATIC cards, no hover */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Eligible"
          value={eligible}
          description="Submitted + accepted"
          icon={Users}
          iconClassName="bg-zinc-100"
        />
        <StatCard
          title="Generated"
          value={generated}
          description={`${pctOfEligible}% of eligible`}
          icon={FileText}
          iconClassName="bg-amber-50"
        />
        <StatCard
          title="Emailed"
          value={emailed}
          description={`${pctOfGenerated}% of generated`}
          icon={Mail}
          iconClassName="bg-blue-50"
        />
        <StatCard
          title="Viewed"
          value={viewed}
          description={`${pctOfEmailed}% of emailed`}
          icon={Eye}
          iconClassName="bg-emerald-50"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="recipients">
        <TabsList>
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
        </TabsList>

        <TabsContent value="recipients">
          <LoaStatusTable
            rows={rows}
            loading={loading}
            onRefetch={fetchRows}
            programId={programId}
            templateId={activeTemplate?.id ?? null}
            onRowClick={handleRowClick}
          />
        </TabsContent>

        <TabsContent value="template">
          <LoaTemplateEditor
            programId={programId}
            onTemplateChange={setActiveTemplate}
          />
        </TabsContent>
      </Tabs>

      {/* Recipient detail drawer */}
      <LoaRecipientDrawer
        row={selectedRow}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSendSuccess={fetchRows}
        programId={programId}
        templateId={activeTemplate?.id ?? null}
      />
    </div>
  );
}
