"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  deleteFormTemplate,
  fetchFormTemplates,
  type FormTemplateSummary,
} from "@/app/components/submissionsMasterData/form-fields/catalog-api";
import { TemplateFormModal } from "./TemplateFormModal";
import { TemplateDetailDrawer } from "./TemplateDetailDrawer";

export default function FormTemplatesPage() {
  const [templates, setTemplates] = useState<FormTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FormTemplateSummary | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchFormTemplates();
      setTemplates(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(t: FormTemplateSummary) {
    if (!window.confirm(`Soft-delete "${t.name}"? This cannot be undone via the UI.`)) return;
    try {
      await deleteFormTemplate(t.id);
      toast.success(`Deleted "${t.name}"`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <DocumentDuplicateIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Form Templates</h1>
            <p className="text-sm text-zinc-500">
              Pre-built sets of form fields that admins can apply to programs.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600"
        >
          <PlusIcon className="h-4 w-4" />
          <span>New Template</span>
        </button>
      </header>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && templates.length === 0 && (
        <p className="text-sm text-zinc-500">No templates yet.</p>
      )}

      {!loading && templates.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Category</th>
                <th className="px-4 py-2 font-semibold">Fields</th>
                <th className="px-4 py-2 font-semibold">Default?</th>
                <th className="px-4 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-zinc-900">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-zinc-500">{t.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{t.category ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600">{t.fieldCount}</td>
                  <td className="px-4 py-2">
                    {t.isDefault ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        Default
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailId(t.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
                        title="View"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(t);
                          setModalOpen(true);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100"
                        title="Edit metadata"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(t)}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TemplateFormModal
        open={modalOpen}
        template={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
      />
      <TemplateDetailDrawer
        open={detailId !== null}
        templateId={detailId}
        onClose={() => setDetailId(null)}
      />
    </section>
  );
}
