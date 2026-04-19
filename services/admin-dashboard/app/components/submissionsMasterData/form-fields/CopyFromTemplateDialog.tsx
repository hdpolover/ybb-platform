"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import {
  applyTemplateToProgram,
  fetchFormTemplateDetail,
  fetchFormTemplates,
  type FormTemplateDetail,
  type FormTemplateSummary,
} from "./catalog-api";

interface CopyFromTemplateDialogProps {
  open: boolean;
  programId: string;
  onClose: () => void;
  onApplied: () => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function CopyFromTemplateDialog({
  open,
  programId,
  onClose,
  onApplied,
}: CopyFromTemplateDialogProps) {
  const [templates, setTemplates] = useState<FormTemplateSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FormTemplateDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [confirmText, setConfirmText] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load template list when the dialog opens
  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setDetail(null);
    setMode("append");
    setConfirmText("");
    setError(null);
    setLoadingList(true);
    fetchFormTemplates()
      .then((rows) => setTemplates(rows))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load templates"),
      )
      .finally(() => setLoadingList(false));
  }, [open]);

  // Load detail when a template is selected
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    fetchFormTemplateDetail(selectedId)
      .then(setDetail)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load template detail"),
      )
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const canApply =
    !!selectedId &&
    !applying &&
    (mode === "append" || confirmText.trim().toUpperCase() === "REPLACE");

  async function handleApply() {
    if (!selectedId) return;
    setApplying(true);
    setError(null);
    try {
      const result = await applyTemplateToProgram(programId, selectedId, mode);
      const skippedCopy =
        result.skipped.length > 0
          ? result.skipped.length <= 5
            ? result.skipped.join(", ")
            : `${result.skipped.slice(0, 5).join(", ")} +${result.skipped.length - 5} more`
          : null;
      toast.success(
        skippedCopy
          ? `Added ${result.added.length} fields. Skipped: ${skippedCopy}`
          : `Added ${result.added.length} fields.`,
      );
      onApplied();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to apply template.";
      setError(message);
      toast.error(message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !applying && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>Copy from template</SheetTitle>
          <SheetDescription>
            Apply a pre-built set of form fields to this program.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-6">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Template picker */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Choose a template
            </h3>
            {loadingList && (
              <p className="text-xs text-zinc-500">Loading templates…</p>
            )}
            {!loadingList && templates.length === 0 && (
              <p className="text-sm text-zinc-500">
                No templates available yet.
              </p>
            )}
            <div className="space-y-2">
              {templates.map((t) => {
                const active = selectedId === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={
                      active
                        ? "w-full rounded-lg border-2 border-blue-500 bg-blue-50 px-3 py-3 text-left transition"
                        : "w-full rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div
                          className={
                            active
                              ? "text-sm font-semibold text-blue-900"
                              : "text-sm font-semibold text-zinc-900"
                          }
                        >
                          {t.name}
                          {t.isDefault ? (
                            <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                              Default
                            </span>
                          ) : null}
                        </div>
                        {t.description && (
                          <p
                            className={
                              active
                                ? "mt-1 text-xs text-blue-800"
                                : "mt-1 text-xs text-zinc-500"
                            }
                          >
                            {t.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={
                          active
                            ? "shrink-0 rounded bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800"
                            : "shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600"
                        }
                      >
                        {t.fieldCount} fields
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Mode */}
          {selectedId && (
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
                    Add template fields; skip any whose key already exists in
                    the program.
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
                    Soft-delete all existing fields in this program, then apply
                    the template. Destructive.
                  </p>
                </button>
              </div>

              {mode === "replace" && (
                <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="mb-2 text-xs text-rose-700">
                    This will soft-delete all form fields currently on this
                    program. Type <strong>REPLACE</strong> to confirm.
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type REPLACE"
                    className={INPUT_CLS}
                  />
                </div>
              )}
            </section>
          )}

          {/* Preview */}
          {selectedId && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Preview
              </h3>
              {loadingDetail && (
                <p className="text-xs text-zinc-500">Loading preview…</p>
              )}
              {detail && (
                <div className="rounded-md border border-zinc-200 bg-white">
                  <ul className="max-h-64 overflow-y-auto divide-y divide-zinc-100">
                    {detail.fields.map((f) => {
                      const name = f.source === "system" ? f.systemFieldKey : f.name;
                      return (
                        <li
                          key={f.id}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <div>
                            <div className="text-sm text-zinc-800">
                              {f.labelOverride ?? f.label ?? name}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {name} · {f.source} · {f.section}
                            </div>
                          </div>
                          {f.isRequired && (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                              Required
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
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
            onClick={handleApply}
            disabled={!canApply}
            className={
              mode === "replace"
                ? "rounded-md border border-rose-500 bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50"
                : "rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
            }
          >
            {applying ? "Applying…" : mode === "replace" ? "Replace fields" : "Apply template"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
