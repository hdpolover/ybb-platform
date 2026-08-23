// services/admin-dashboard/app/components/shared/copy-from-program/CopyFromProgramDialog.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  postCopyEntity,
  type CopyPreviewItem,
  type CopyResult,
} from "./copy-api";

interface CopyFromProgramDialogProps {
  open: boolean;
  entityKey: string;
  entityLabel: string;
  programId: string;
  /** Hides the append/replace toggle and forces mode='replace' when false (e.g. program-details). */
  supportsAppend: boolean;
  /**
   * When set, programs from this brand (case-insensitive match) are pinned to
   * the top of the source picker and the newest one is pre-selected on open.
   * Omit for surfaces that should not default to any particular source.
   */
  referenceBrandName?: string;
  /**
   * Extra sentence appended into the replace-mode disclaimer, after the
   * generic soft-delete notice and before the "Type REPLACE to confirm"
   * instruction. Use for surface-specific warnings that don't hold true for
   * every entity (e.g. how replacing this entity interacts with other live
   * data). Omit for the plain generic disclaimer.
   */
  replaceCaveat?: ReactNode;
  onClose: () => void;
  onApplied: (result: CopyResult) => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function CopyFromProgramDialog({
  open,
  entityKey,
  entityLabel,
  programId,
  supportsAppend,
  referenceBrandName,
  replaceCaveat,
  onClose,
  onApplied,
}: CopyFromProgramDialogProps) {
  const { accessiblePrograms } = useAuth();

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [items, setItems] = useState<CopyPreviewItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "replace">(supportsAppend ? "append" : "replace");
  const [confirmText, setConfirmText] = useState("");
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceCounts, setSourceCounts] = useState<Map<string, number>>(new Map());

  const currentBrandId = useMemo(
    () => accessiblePrograms.find((p) => p.programId === programId)?.brandId ?? null,
    [accessiblePrograms, programId],
  );

  function isReferenceProgram(brandName: string): boolean {
    if (!referenceBrandName) return false;
    return brandName.trim().toLowerCase() === referenceBrandName.trim().toLowerCase();
  }

  // All eligible source programs (excluding the current one), split into
  // reference and non-reference groups when referenceBrandName is set.
  const { referenceOptions, otherOptions } = useMemo(() => {
    const eligible = accessiblePrograms.filter((p) => p.programId !== programId);

    if (!referenceBrandName) {
      const all = eligible
        .slice()
        .sort((a, b) =>
          a.brandName === b.brandName ? b.programYear - a.programYear : a.brandName.localeCompare(b.brandName),
        );
      return { referenceOptions: [], otherOptions: all };
    }

    const ref = eligible
      .filter((p) => isReferenceProgram(p.brandName))
      .slice()
      .sort((a, b) => b.programYear - a.programYear); // newest first

    const other = eligible
      .filter((p) => !isReferenceProgram(p.brandName))
      .slice()
      .sort((a, b) =>
        a.brandName === b.brandName ? b.programYear - a.programYear : a.brandName.localeCompare(b.brandName),
      );

    return { referenceOptions: ref, otherOptions: other };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessiblePrograms, programId, referenceBrandName]);

  const allSourceOptions = useMemo(
    () => [...referenceOptions, ...otherOptions],
    [referenceOptions, otherOptions],
  );

  const defaultReferenceId = useMemo(
    () => referenceOptions[0]?.programId ?? null,
    [referenceOptions],
  );

  const filteredSourceOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSourceOptions;
    return allSourceOptions.filter((p) =>
      [p.programName, p.brandName, String(p.programYear)].some((s) => s.toLowerCase().includes(q)),
    );
  }, [allSourceOptions, search]);

  const selectedSource = useMemo(
    () => accessiblePrograms.find((p) => p.programId === sourceId) ?? null,
    [accessiblePrograms, sourceId],
  );

  // Reset everything when the dialog opens; default-select the newest
  // reference program if this surface has one configured.
  useEffect(() => {
    if (!open) return;
    setSourceId(defaultReferenceId);
    setItems([]);
    setSelectedIds(new Set());
    setLoadingItems(false);
    setItemsError(null);
    setMode(supportsAppend ? "append" : "replace");
    setConfirmText("");
    setSearch("");
  }, [open, defaultReferenceId, supportsAppend]);

  // Fetch per-source counts for the candidate list in the background once
  // the dialog opens, so the dropdown can show "(N items)" per option.
  useEffect(() => {
    if (!open || allSourceOptions.length === 0) return;
    let cancelled = false;
    fetchCopySourceCounts(entityKey, allSourceOptions.map((p) => p.programId))
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

  // Load the source program's items when the source changes.
  useEffect(() => {
    if (!sourceId) {
      setItems([]);
      setSelectedIds(new Set());
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    setItemsError(null);
    fetchCopyPreview(entityKey, sourceId)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setSelectedIds(new Set(rows.map((r) => r.id)));
      })
      .catch((err) => {
        if (cancelled) return;
        setItemsError(err instanceof Error ? err.message : "Failed to load items");
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

  const crossBrandMediaWarning = useMemo(() => {
    if (!selectedSource || !currentBrandId) return false;
    if (selectedSource.brandId === currentBrandId) return false;
    return items.some((i) => selectedIds.has(i.id) && i.hasExternalMedia);
  }, [selectedSource, currentBrandId, items, selectedIds]);

  const replaceConfirmed = mode !== "replace" || confirmText.trim().toUpperCase() === "REPLACE";
  const canApply = !!sourceId && selectedIds.size > 0 && replaceConfirmed && !applying;

  async function handleApply() {
    if (!sourceId) return;
    setApplying(true);
    try {
      const itemIds = selectedIds.size === items.length ? undefined : Array.from(selectedIds);
      const result = await postCopyEntity(entityKey, programId, { sourceProgramId: sourceId, itemIds, mode });
      toast.success(
        mode === "replace"
          ? `Replaced ${result.replaced} ${entityLabel.toLowerCase()}, copied ${result.created} new.`
          : result.skipped > 0
            ? `Copied ${result.created} ${entityLabel.toLowerCase()}. Skipped ${result.skipped} duplicate(s).`
            : `Copied ${result.created} ${entityLabel.toLowerCase()}.`,
      );
      onApplied(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to copy ${entityLabel.toLowerCase()}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !applying && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>Copy from another program</SheetTitle>
          <SheetDescription>
            Copy {entityLabel.toLowerCase()} from any program you can access into this one.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Source program
            </h3>

            <input
              type="search"
              aria-label="Search programs"
              placeholder="Search by name, brand, or year…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${INPUT_CLS} mb-2`}
            />

            <select
              className={INPUT_CLS}
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(e.target.value || null)}
            >
              <option value="">Select a program…</option>
              {filteredSourceOptions.map((p) => {
                const isRef = isReferenceProgram(p.brandName);
                const count = sourceCounts.get(p.programId);
                const countSuffix = count === undefined ? "" : ` (${count})`;
                const label = isRef
                  ? `★ Reference · ${p.programName} · ${p.brandName} · ${p.programYear}${countSuffix}`
                  : `${p.programName} · ${p.brandName} · ${p.programYear}${countSuffix}`;
                return (
                  <option key={p.programId} value={p.programId}>
                    {label}
                  </option>
                );
              })}
            </select>
          </section>

          {loadingItems && <p className="text-xs text-zinc-500">Loading {entityLabel.toLowerCase()}…</p>}
          {itemsError && <p className="text-sm text-rose-600">{itemsError}</p>}

          {!loadingItems && !itemsError && items.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {entityLabel} ({selectedIds.size}/{items.length})
                </h3>
                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={toggleAll}>
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              </div>
              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                      />
                      <span className="text-sm text-zinc-800">{item.label}</span>
                      {item.meta ? <span className="ml-auto text-[11px] text-zinc-400">{item.meta}</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!loadingItems && !itemsError && sourceId && items.length === 0 && (
            <p className="text-xs text-zinc-500">This program has no {entityLabel.toLowerCase()} to copy.</p>
          )}

          {supportsAppend && items.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Mode</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("append")}
                  className={
                    mode === "append"
                      ? "rounded-lg border-2 border-blue-500 bg-blue-50 px-3 py-3 text-left"
                      : "rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left hover:border-zinc-300"
                  }
                >
                  <div className="text-sm font-semibold text-zinc-900">Append</div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Add selected items; skip any whose key already exists in this program.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("replace")}
                  className={
                    mode === "replace"
                      ? "rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-3 text-left"
                      : "rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left hover:border-zinc-300"
                  }
                >
                  <div className="text-sm font-semibold text-rose-700">Replace</div>
                  <p className="mt-1 text-xs text-rose-600">
                    Remove this program&apos;s current {entityLabel.toLowerCase()} first, then copy. Destructive.
                  </p>
                </button>
              </div>
            </section>
          )}

          {mode === "replace" && items.length > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
              <p className="mb-2 text-xs text-rose-700">
                This will soft-delete this program&apos;s current {entityLabel.toLowerCase()}.
                {replaceCaveat && (
                  <>
                    {" "}
                    {replaceCaveat}
                  </>
                )}
                {" "}
                Type <strong>REPLACE</strong> to confirm.
              </p>
              <input
                type="text"
                aria-label={`Type REPLACE to confirm replacing all ${entityLabel.toLowerCase()}`}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type REPLACE"
                className={INPUT_CLS}
              />
            </div>
          )}

          {crossBrandMediaWarning && (
            <p className="text-xs text-zinc-500">
              Some selected items reference media from another brand&apos;s storage. The images will work, but
              consider re-uploading them under this brand.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={!canApply}
            className={
              mode === "replace"
                ? "rounded-md border border-rose-500 bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50"
                : "rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
            }
          >
            {applying ? "Copying…" : mode === "replace" ? "Replace" : "Copy"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
