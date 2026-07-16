"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  deleteSystemFormField,
  fetchSystemFormFields,
  type SystemFormField,
} from "@/app/components/submissionsMasterData/form-fields/catalog-api";
import { SystemFieldFormModal } from "./SystemFieldFormModal";

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Identity",
  program_structure: "Program Structure",
  professional: "Professional",
  logistics: "Logistics",
  misc: "Misc",
};

const CATEGORY_ORDER = ["identity", "program_structure", "professional", "logistics", "misc"];

export default function SystemFormFieldsPage() {
  const [fields, setFields] = useState<SystemFormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SystemFormField | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSystemFormFields({ includeInactive: true });
      setFields(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(field: SystemFormField) {
    if (!window.confirm(`Archive "${field.label}"? It can be reactivated by editing later.`)) {
      return;
    }
    setDeletingId(field.id);
    try {
      await deleteSystemFormField(field.id);
      toast.success(`Archived "${field.label}"`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setDeletingId(null);
    }
  }

  const active = fields.filter((f) => f.isActive);
  const inactive = fields.filter((f) => !f.isActive);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    rows: active.filter((f) => f.category === cat).sort((a, b) => a.order - b.order),
  })).filter((g) => g.rows.length > 0);

  const unknownCategories = Array.from(
    new Set(active.map((f) => f.category).filter((c) => !CATEGORY_ORDER.includes(c))),
  )
    .sort()
    .map((cat) => ({
      category: cat,
      rows: active.filter((f) => f.category === cat).sort((a, b) => a.order - b.order),
    }));

  return (
    <section className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <SparklesIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">System Form Fields</h1>
            <p className="text-sm text-zinc-500">
              The canonical catalog. Admins pick from these when building per-program forms.
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
          <span>New System Field</span>
        </button>
      </header>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && [...grouped, ...unknownCategories].map((g) => (
        <section key={g.category}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {CATEGORY_LABELS[g.category] ?? g.category}
          </h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-2 font-semibold">Label</th>
                  <th className="px-4 py-2 font-semibold">Key</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {g.rows.map((f) => (
                  <tr key={f.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-2 font-medium text-zinc-900">
                      {f.label}
                      {f.isMagic && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                          Magic
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px]">{f.key}</code>
                    </td>
                    <td className="px-4 py-2 text-zinc-600">{f.type}</td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {f.isMagic ? (
                        <span className="text-[11px] text-zinc-400">Code-backed</span>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(f);
                              setModalOpen(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(f)}
                            disabled={deletingId === f.id}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-60"
                            title="Archive"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {!loading && inactive.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Archived
          </h2>
          <div className="overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-white">
            <table className="min-w-full text-left text-sm">
              <tbody className="divide-y divide-zinc-100 bg-white">
                {inactive.map((f) => (
                  <tr key={f.id} className="text-zinc-500">
                    <td className="px-4 py-2 line-through">{f.label}</td>
                    <td className="px-4 py-2">
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px]">{f.key}</code>
                    </td>
                    <td className="px-4 py-2">{f.type}</td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">
                        Inactive
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(f);
                          setModalOpen(true);
                        }}
                        className="text-[11px] font-medium text-blue-600 hover:underline"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SystemFieldFormModal
        open={modalOpen}
        initialField={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
      />
    </section>
  );
}
