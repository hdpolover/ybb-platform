// services/admin-dashboard/app/components/shared/content-templates/CreateTemplateFromProgramDialog.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  fetchCopyPreview,
  fetchCopySourceCounts,
  type CopyPreviewItem,
} from "@/app/components/shared/copy-from-program/copy-api";
import { createContentTemplateFromProgram } from "./content-templates-api";

interface CreateTemplateFromProgramDialogProps {
  open: boolean;
  entityKey: string;
  entityLabel: string;
  onClose: () => void;
  onCreated: () => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

// Mirrors CopyFromProgramDialog's source-program-and-item picker (same
// fetchCopyPreview/fetchCopySourceCounts calls), plus a name/description/
// isDefault form up front — the only genuinely new call this dialog makes is
// the final createContentTemplateFromProgram.
export function CreateTemplateFromProgramDialog({
  open,
  entityKey,
  entityLabel,
  onClose,
  onCreated,
}: CreateTemplateFromProgramDialogProps) {
  const { accessiblePrograms } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const [search, setSearch] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceCounts, setSourceCounts] = useState<Map<string, number>>(new Map());
  const [items, setItems] = useState<CopyPreviewItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedPrograms = useMemo(
    () =>
      [...accessiblePrograms].sort((a, b) =>
        a.brandName === b.brandName ? b.programYear - a.programYear : a.brandName.localeCompare(b.brandName),
      ),
    [accessiblePrograms],
  );

  const filteredPrograms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedPrograms;
    return sortedPrograms.filter((p) =>
      [p.programName, p.brandName, String(p.programYear)].some((s) => s.toLowerCase().includes(q)),
    );
  }, [sortedPrograms, search]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setIsDefault(false);
    setSearch("");
    setSourceId(null);
    setItems([]);
    setSelectedIds(new Set());
    setError(null);
  }, [open]);

  // Background counts so the source dropdown can show "(N items)" per option.
  useEffect(() => {
    if (!open || sortedPrograms.length === 0) return;
    let cancelled = false;
    fetchCopySourceCounts(entityKey, sortedPrograms.map((p) => p.programId))
      .then((counts) => {
        if (cancelled) return;
        setSourceCounts(new Map(counts.map((c) => [c.programId, c.count])));
      })
      .catch(() => {
        // Counts are a display nicety, not required to use the dialog.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityKey]);

  useEffect(() => {
    if (!sourceId) {
      setItems([]);
      setSelectedIds(new Set());
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    setError(null);
    fetchCopyPreview(entityKey, sourceId)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setSelectedIds(new Set(rows.map((r) => r.id)));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load items");
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityKey, sourceId]);

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canSave = !!sourceId && name.trim().length > 0 && selectedIds.size > 0 && !saving;

  async function handleSave() {
    if (!sourceId) return;
    setSaving(true);
    setError(null);
    try {
      const itemIds = selectedIds.size === items.length ? undefined : Array.from(selectedIds);
      const created = await createContentTemplateFromProgram({
        entityType: entityKey,
        programId: sourceId,
        itemIds,
        name: name.trim(),
        description: description.trim() || undefined,
        isDefault,
      });
      toast.success(`Created "${created.name}"`);
      onCreated();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create template";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>New {entityLabel} template</SheetTitle>
          <SheetDescription>
            Export a program&apos;s current {entityLabel.toLowerCase()} into a reusable template.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-6">
          {error && <p className="text-sm text-rose-600">{error}</p>}

          <section className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Name</label>
              <input
                className={INPUT_CLS}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
                maxLength={150}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Description
              </label>
              <input
                className={INPUT_CLS}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Set as default {entityLabel.toLowerCase()} template
            </label>
            {isDefault && (
              <p className="text-xs text-amber-600">
                This will replace the current default {entityLabel.toLowerCase()} template, if any.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Source program</h3>
            <input
              type="search"
              aria-label="Search programs"
              placeholder="Search by name, brand, or year…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${INPUT_CLS} mb-2`}
            />
            <select className={INPUT_CLS} value={sourceId ?? ""} onChange={(e) => setSourceId(e.target.value || null)}>
              <option value="">Select a program…</option>
              {filteredPrograms.map((p) => {
                const count = sourceCounts.get(p.programId);
                const countSuffix = count === undefined ? "" : ` (${count})`;
                return (
                  <option key={p.programId} value={p.programId}>
                    {p.programName} · {p.brandName} · {p.programYear}
                    {countSuffix}
                  </option>
                );
              })}
            </select>
          </section>

          {loadingItems && <p className="text-xs text-zinc-500">Loading {entityLabel.toLowerCase()}…</p>}

          {!loadingItems && items.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {entityLabel} ({selectedIds.size}/{items.length})
                </h3>
                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={toggleAll}>
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              </div>
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-zinc-50">
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleOne(item.id)} />
                      <span className="text-sm text-zinc-800">{item.label}</span>
                      {item.meta ? <span className="ml-auto text-[11px] text-zinc-400">{item.meta}</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!loadingItems && sourceId && items.length === 0 && (
            <p className="text-xs text-zinc-500">This program has no {entityLabel.toLowerCase()} to export.</p>
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Template"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
