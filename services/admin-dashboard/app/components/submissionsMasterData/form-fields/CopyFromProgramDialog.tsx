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
  copyFieldsFromProgram,
  fetchProgramFormFields,
  type ProgramFormFieldRow,
} from "./catalog-api";

// The canonical reference program brand. Its programs are pinned to the top
// of the copy-source picker and pre-selected by default, because admins treat
// CYS as the battle-tested submission-form reference to copy from.
const REFERENCE_BRAND_NAME = 'China Youth Summit';

interface CopyFromProgramDialogProps {
  open: boolean;
  programId: string;
  onClose: () => void;
  onApplied: () => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function isReferenceProgram(brandName: string): boolean {
  return brandName.trim().toLowerCase() === REFERENCE_BRAND_NAME.toLowerCase();
}

export function CopyFromProgramDialog({
  open,
  programId,
  onClose,
  onApplied,
}: CopyFromProgramDialogProps) {
  const { accessiblePrograms } = useAuth();

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [fields, setFields] = useState<ProgramFormFieldRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [confirmText, setConfirmText] = useState("");
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState("");

  const currentBrandId = useMemo(
    () => accessiblePrograms.find((p) => p.programId === programId)?.brandId ?? null,
    [accessiblePrograms, programId],
  );

  // All eligible source programs (excluding the current one), split into
  // reference and non-reference groups, each sorted internally.
  const { referenceOptions, otherOptions } = useMemo(() => {
    const eligible = accessiblePrograms.filter((p) => p.programId !== programId);

    const ref = eligible
      .filter((p) => isReferenceProgram(p.brandName))
      .slice()
      .sort((a, b) => b.programYear - a.programYear); // newest first

    const other = eligible
      .filter((p) => !isReferenceProgram(p.brandName))
      .slice()
      .sort((a, b) =>
        a.brandName === b.brandName
          ? b.programYear - a.programYear
          : a.brandName.localeCompare(b.brandName),
      );

    return { referenceOptions: ref, otherOptions: other };
  }, [accessiblePrograms, programId]);

  // Combined ordered list: reference pinned first, then others.
  const allSourceOptions = useMemo(
    () => [...referenceOptions, ...otherOptions],
    [referenceOptions, otherOptions],
  );

  // The newest reference program (first in the pinned group), if any.
  const defaultReferenceId = useMemo(
    () => referenceOptions[0]?.programId ?? null,
    [referenceOptions],
  );

  // Filter by search query (case-insensitive substring across name, brand, year).
  const filteredSourceOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSourceOptions;
    return allSourceOptions.filter((p) =>
      [p.programName, p.brandName, String(p.programYear)].some((s) =>
        s.toLowerCase().includes(q),
      ),
    );
  }, [allSourceOptions, search]);

  const selectedSource = useMemo(
    () => accessiblePrograms.find((p) => p.programId === sourceId) ?? null,
    [accessiblePrograms, sourceId],
  );

  // Reset everything when the dialog opens and default-select the newest
  // reference program if one exists.
  useEffect(() => {
    if (!open) return;
    setSourceId(defaultReferenceId);
    setFields([]);
    setSelectedIds(new Set());
    setLoadingFields(false);
    setFieldsError(null);
    setMode("append");
    setConfirmText("");
    setSearch("");
  }, [open, defaultReferenceId]);

  // Load the source program's fields when the source changes.
  useEffect(() => {
    if (!sourceId) {
      setFields([]);
      setSelectedIds(new Set());
      return;
    }
    // Guard against a stale fetch overwriting state if the admin switches
    // source program before the previous request resolves.
    let cancelled = false;
    setLoadingFields(true);
    setFieldsError(null);
    fetchProgramFormFields(sourceId)
      .then((rows) => {
        if (cancelled) return;
        setFields(rows);
        setSelectedIds(new Set(rows.map((r) => r.id)));
      })
      .catch((err) => {
        if (cancelled) return;
        setFieldsError(err instanceof Error ? err.message : "Failed to load fields");
      })
      .finally(() => {
        if (!cancelled) setLoadingFields(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  const allSelected = fields.length > 0 && selectedIds.size === fields.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(fields.map((f) => f.id)));
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
    return fields.some(
      (f) =>
        selectedIds.has(f.id) &&
        (Boolean(f.mediaUrl) || (f.helpAssets?.length ?? 0) > 0),
    );
  }, [selectedSource, currentBrandId, fields, selectedIds]);

  const replaceConfirmed = mode !== "replace" || confirmText.trim().toUpperCase() === "REPLACE";
  const canApply = !!sourceId && selectedIds.size > 0 && replaceConfirmed && !applying;

  async function handleApply() {
    if (!sourceId) return;
    setApplying(true);
    try {
      const fieldIds =
        selectedIds.size === fields.length ? undefined : Array.from(selectedIds);
      const result = await copyFieldsFromProgram(programId, {
        sourceProgramId: sourceId,
        fieldIds,
        mode,
      });
      const skippedCopy =
        result.skipped.length > 0
          ? result.skipped.length <= 5
            ? result.skipped.join(", ")
            : `${result.skipped.slice(0, 5).join(", ")} +${result.skipped.length - 5} more`
          : null;
      toast.success(
        skippedCopy
          ? `Copied ${result.added.length} field(s). Skipped: ${skippedCopy}`
          : `Copied ${result.added.length} field(s).`,
      );
      onApplied();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to copy fields");
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
            Copy application form fields from any program you can access into this one.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-6">
          {/* Source program picker */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Source program
            </h3>

            {/* Search filter */}
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
                const label = isRef
                  ? `★ Reference · ${p.programName} · ${p.brandName} · ${p.programYear}`
                  : `${p.programName} · ${p.brandName} · ${p.programYear}`;
                return (
                  <option key={p.programId} value={p.programId}>
                    {label}
                  </option>
                );
              })}
            </select>
          </section>

          {loadingFields && (
            <p className="text-xs text-zinc-500">Loading fields…</p>
          )}
          {fieldsError && (
            <p className="text-sm text-rose-600">{fieldsError}</p>
          )}

          {/* Field selector */}
          {!loadingFields && !fieldsError && fields.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Fields ({selectedIds.size}/{fields.length})
                </h3>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={toggleAll}
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              </div>
              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2">
                {fields.map((f) => (
                  <li key={f.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(f.id)}
                        onChange={() => toggleOne(f.id)}
                      />
                      <span className="text-sm text-zinc-800">{f.label}</span>
                      <span className="ml-auto text-[11px] text-zinc-400">
                        {f.fieldName} · {f.fieldType}
                        {f.section ? ` · ${f.section}` : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Mode */}
          {fields.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Mode
              </h3>
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
                    Add selected fields; skip any whose key already exists in this program.
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
                    Remove this program&apos;s current fields first, then copy. Destructive.
                  </p>
                </button>
              </div>

              {mode === "replace" && (
                <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="mb-2 text-xs text-rose-700">
                    This will soft-delete all form fields currently on this program. If
                    participants have already submitted answers, those answers are kept but
                    may no longer match the new fields. Type <strong>REPLACE</strong> to
                    confirm.
                  </p>
                  <input
                    type="text"
                    aria-label="Type REPLACE to confirm replacing all fields"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type REPLACE"
                    className={INPUT_CLS}
                  />
                </div>
              )}
            </section>
          )}

          {/* Cross-brand media warning */}
          {crossBrandMediaWarning && (
            <p className="text-xs text-zinc-500">
              Some selected fields reference media from another brand&apos;s storage. The
              images will work, but consider re-uploading them under this brand.
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
            {applying ? "Copying…" : mode === "replace" ? "Replace fields" : "Copy fields"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
