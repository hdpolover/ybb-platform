// services/admin-dashboard/app/platform/content-templates/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutTemplate, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/src/admin/page-header";
import { EmptyState } from "@/src/admin/empty-state";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { Button } from "@/src/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  fetchContentTemplates,
  deleteContentTemplate,
  updateContentTemplate,
  type ContentTemplateSummary,
} from "@/app/components/shared/content-templates/content-templates-api";
import { ContentTemplatesTable } from "@/app/components/shared/content-templates/ContentTemplatesTable";
import { CreateTemplateFromProgramDialog } from "@/app/components/shared/content-templates/CreateTemplateFromProgramDialog";
import { EditContentTemplateDialog } from "@/app/components/shared/content-templates/EditContentTemplateDialog";
import { ContentTemplateDetailDrawer } from "@/app/components/shared/content-templates/ContentTemplateDetailDrawer";

// Matches the seven registered ProgramCopier key/label pairs exactly
// (form-fields.copier.ts, participation-categories.copier.ts, etc.). Not
// fetched from the registry endpoint: that endpoint is scoped to a
// :programId and this screen has no natural program to call it against.
const ENTITY_TYPES = [
  { key: "form-fields", label: "Application Form Fields" },
  { key: "participation-categories", label: "Participation Categories" },
  { key: "timelines", label: "Timelines" },
  { key: "rundowns", label: "Program Rundowns" },
  { key: "faqs", label: "FAQs" },
  { key: "payments", label: "Payment Options" },
  { key: "program-details", label: "Participant-Facing Content" },
] as const;

export default function ContentTemplatesPage() {
  const { accessConfig } = useAuth();
  const canManage = accessConfig.isSuperAdmin;

  const [activeKey, setActiveKey] = useState<string>(ENTITY_TYPES[0].key);
  const [templates, setTemplates] = useState<ContentTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ContentTemplateSummary | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentTemplateSummary | null>(null);
  const [defaultTarget, setDefaultTarget] = useState<ContentTemplateSummary | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);

  const activeLabel = ENTITY_TYPES.find((e) => e.key === activeKey)?.label ?? activeKey;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchContentTemplates(activeKey);
      setTemplates(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [activeKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteContentTemplate(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleConfirmSetDefault() {
    if (!defaultTarget) return;
    setSettingDefault(true);
    try {
      await updateContentTemplate(defaultTarget.id, { isDefault: true });
      toast.success(`"${defaultTarget.name}" is now the default ${activeLabel.toLowerCase()} template`);
      setDefaultTarget(null);
      // Refetch rather than optimistically flipping one row: the server
      // clears the previous default inside the same transaction, so a
      // second row's isDefault would otherwise go stale in the client.
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set default");
    } finally {
      setSettingDefault(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Templates"
        description="Reusable content sets that admins can apply to any program."
        actions={
          canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          )
        }
      />

      <Tabs value={activeKey} onValueChange={setActiveKey}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {ENTITY_TYPES.map((e) => (
            <TabsTrigger
              key={e.key}
              value={e.key}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              {e.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-zinc-500">Loading templates…</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title={`No ${activeLabel.toLowerCase()} templates yet`}
          description={
            canManage
              ? `Create one from an existing program's ${activeLabel.toLowerCase()} to reuse it across other programs.`
              : `No ${activeLabel.toLowerCase()} templates have been created yet.`
          }
          action={canManage ? { label: "New Template", onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <ContentTemplatesTable
            templates={templates}
            canManage={canManage}
            onView={(t) => setDetailId(t.id)}
            onEdit={(t) => setEditing(t)}
            onSetDefault={(t) => setDefaultTarget(t)}
            onDelete={(t) => setDeleteTarget(t)}
          />
        </div>
      )}

      <CreateTemplateFromProgramDialog
        open={createOpen}
        entityKey={activeKey}
        entityLabel={activeLabel}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />

      <EditContentTemplateDialog
        open={editing !== null}
        template={editing}
        entityLabel={activeLabel}
        onClose={() => setEditing(null)}
        onSaved={() => void load()}
      />

      <ContentTemplateDetailDrawer open={detailId !== null} templateId={detailId} onClose={() => setDetailId(null)} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete template"
        description={`Delete "${deleteTarget?.name ?? "this template"}"? This soft-deletes it — it will no longer appear here or be applicable to programs.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={defaultTarget !== null}
        onOpenChange={(open) => !open && setDefaultTarget(null)}
        title="Set as default"
        description={`Make "${defaultTarget?.name ?? "this template"}" the default ${activeLabel.toLowerCase()} template? This replaces the current default, if any.`}
        confirmLabel="Set as default"
        variant="default"
        onConfirm={handleConfirmSetDefault}
        loading={settingDefault}
      />
    </div>
  );
}
