// services/admin-dashboard/app/components/shared/copy-from-program/CopyFromTemplateDialog.tsx
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
  fetchContentTemplates,
  type ContentTemplateSummary,
} from "@/app/components/shared/content-templates/content-templates-api";
import { postApplyTemplate, type CopyResult } from "./copy-api";

interface CopyFromTemplateDialogProps {
  open: boolean;
  entityKey: string;
  entityLabel: string;
  programId: string;
  /** Hides the append/replace toggle and forces mode='replace' when false (e.g. program-details). */
  supportsAppend: boolean;
  onClose: () => void;
  onApplied: (result: CopyResult) => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function CopyFromTemplateDialog({
  open,
  entityKey,
  entityLabel,
  programId,
  supportsAppend,
  onClose,
  onApplied,
}: CopyFromTemplateDialogProps) {
  const [templates, setTemplates] = useState<ContentTemplateSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "replace">(supportsAppend ? "append" : "replace");
  const [confirmText, setConfirmText] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setTemplates([]);
    setMode(supportsAppend ? "append" : "replace");
    setConfirmText("");
    setListError(null);
    setLoadingList(true);
    fetchContentTemplates(entityKey)
      .then((rows) => setTemplates(rows))
      .catch((err) => setListError(err instanceof Error ? err.message : "Failed to load templates"))
      .finally(() => setLoadingList(false));
  }, [open, entityKey, supportsAppend]);

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;
  const replaceConfirmed = mode !== "replace" || confirmText.trim().toUpperCase() === "REPLACE";
  const canApply = !!selectedId && replaceConfirmed && !applying;

  async function handleApply() {
    if (!selectedId) return;
    setApplying(true);
    try {
      const result = await postApplyTemplate(entityKey, programId, { templateId: selectedId, mode });
      toast.success(
        result.skipped > 0
          ? `Applied "${selectedTemplate?.name}" — added ${result.created}, skipped ${result.skipped} duplicate(s).`
          : `Applied "${selectedTemplate?.name}".`,
      );
      onApplied(result);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to apply ${entityLabel.toLowerCase()} template`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !applying && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>Copy from template</SheetTitle>
          <SheetDescription>Apply a saved {entityLabel.toLowerCase()} template to this program.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-6">
          {loadingList && <p className="text-xs text-zinc-500">Loading templates…</p>}
          {listError && <p className="text-sm text-rose-600">{listError}</p>}

          {!loadingList && !listError && templates.length === 0 && (
            <p className="text-xs text-zinc-500">No {entityLabel.toLowerCase()} templates exist yet.</p>
          )}

          {!loadingList && !listError && templates.length > 0 && (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <label
                    className={
                      selectedId === t.id
                        ? "flex cursor-pointer flex-col gap-1 rounded-lg border-2 border-blue-500 bg-blue-50 px-3 py-3"
                        : "flex cursor-pointer flex-col gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-3 hover:border-zinc-300"
                    }
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="content-template"
                        checked={selectedId === t.id}
                        onChange={() => setSelectedId(t.id)}
                      />
                      <span className="text-sm font-semibold text-zinc-900">{t.name}</span>
                      {t.isDefault && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                          Default
                        </span>
                      )}
                    </span>
                    {t.description && <span className="pl-6 text-xs text-zinc-500">{t.description}</span>}
                    <span className="pl-6 text-[11px] text-zinc-400">{t.itemCount} item(s)</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {supportsAppend && selectedId && (
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
                  <p className="mt-1 text-xs text-zinc-500">Add the template&apos;s items; skip any whose key already exists.</p>
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
                    Remove this program&apos;s current {entityLabel.toLowerCase()} first, then apply. Destructive.
                  </p>
                </button>
              </div>
            </section>
          )}

          {mode === "replace" && selectedId && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
              <p className="mb-2 text-xs text-rose-700">
                This will soft-delete this program&apos;s current {entityLabel.toLowerCase()}. Type <strong>REPLACE</strong> to
                confirm.
              </p>
              <input
                type="text"
                aria-label="Type REPLACE to confirm replacing all items"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type REPLACE"
                className={INPUT_CLS}
              />
            </div>
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
            {applying ? "Applying…" : mode === "replace" ? "Replace" : "Apply"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
