// services/admin-dashboard/app/platform/components/programs/CloneOnCreateDialog.tsx
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
import { EmptyState } from "@/src/admin/empty-state";
import {
  fetchCopyRegistry,
  postCloneFrom,
  type CopyRegistryEntry,
} from "@/app/components/shared/copy-from-program/copy-api";

export interface CloneOnCreateSourceProgram {
  id: string;
  name: string;
  year: number;
}

interface CloneOnCreateDialogProps {
  open: boolean;
  /** The just-created program to clone content INTO. */
  newProgramId: string;
  /** Other programs in the same brand, any order. */
  sourcePrograms: CloneOnCreateSourceProgram[];
  onClose: () => void;
  onDone: () => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

/**
 * `program-details` is the only registered copier with `supportsAppend:
 * false` (it only ever accepts mode:'replace'). Every other entity defaults
 * to 'append' — "append where append is even a valid choice" is the only
 * reading of "append is the safer default" that clone-on-create can
 * actually satisfy, since defaulting program-details to 'append' would make
 * every batch that includes it fail the API's append_not_supported gate.
 *
 * Replacing on an append-incapable entity is safe here specifically because
 * this dialog only ever runs immediately after a program was just created:
 * the target has nothing worth replacing, so postCloneFrom (copy-api.ts)
 * auto-sets confirmReplace when it sees a replace-mode entity in the
 * request, with no separate typed-REPLACE step — unlike the single-surface
 * CopyFromProgramDialog/CopyFromTemplateDialog, which both still require it
 * because their targets can already hold real data.
 */
function resolveMode(entry: CopyRegistryEntry): "append" | "replace" {
  return entry.supportsAppend ? "append" : "replace";
}

export function CloneOnCreateDialog({
  open,
  newProgramId,
  sourcePrograms,
  onClose,
  onDone,
}: CloneOnCreateDialogProps) {
  const sorted = [...sourcePrograms].sort((a, b) => b.year - a.year);

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [entries, setEntries] = useState<CopyRegistryEntry[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when the dialog transitions closed -> open, done during render
  // (guarded by comparing against the previous `open` value) rather than in
  // a useEffect — see the reasoning + linked React docs in
  // app/programs/[programId]/scoring/fully-funded/[participantId]/page.tsx,
  // which established this pattern in this codebase to satisfy
  // react-hooks/set-state-in-effect. `sourcePrograms` is a fresh array on
  // every parent render (page.tsx passes an inline .filter().map()), so
  // keying a reset effect off it (or off the locally-derived `sorted`)
  // would re-fire on unrelated parent re-renders while the sheet is open;
  // keying only off the `open` boolean avoids that entirely.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSourceId(sorted[0]?.id ?? null);
      setEntries([]);
      setChecked(new Set());
      setError(null);
    }
  }

  // Fetching the registry is a genuine external side effect (network call),
  // so it stays in a real effect. There's no null-source branch that only
  // sets state: sourceId is seeded above whenever the dialog opens, and the
  // <select> below always offers a non-empty value, so it never goes back
  // to null while open.
  useEffect(() => {
    if (!sourceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCopyRegistry(sourceId)
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        // Default-checked: every copier with at least one item to clone.
        setChecked(new Set(rows.filter((r) => r.count > 0).map((r) => r.key)));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load content counts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const selectedEntries = entries.filter((e) => checked.has(e.key));
  const hasClonableContent = entries.some((e) => e.count > 0);
  const canApply = !!sourceId && selectedEntries.length > 0 && !applying;

  async function handleApply() {
    if (!sourceId) return;
    setApplying(true);
    setError(null);
    try {
      const entities = selectedEntries.map((e) => ({ key: e.key, mode: resolveMode(e) }));
      // clone-from runs every entity inside one transaction: either all of
      // them land, or (any single copier throwing) none of them do. There
      // is no partial-success state to report here.
      const results = await postCloneFrom(newProgramId, { sourceProgramId: sourceId, entities });

      // results is a Record<string, CopyResult> keyed by entity — a batch
      // response, not one merged CopyResult. Report each entity's own
      // created/skipped/replaced rather than summing them into a single
      // number that would misread as one entity's outcome.
      toast.success(
        `Cloned ${entities.length} content type${entities.length === 1 ? "" : "s"} into the new program.`,
        {
          description: (
            <div className="space-y-0.5">
              {selectedEntries.map((e) => {
                const r = results[e.key];
                if (!r) return null;
                const parts = [`${r.created} created`];
                if (r.skipped > 0) parts.push(`${r.skipped} skipped`);
                if (r.replaced > 0) parts.push(`${r.replaced} replaced`);
                return (
                  <div key={e.key}>
                    {e.label}: {parts.join(", ")}
                  </div>
                );
              })}
            </div>
          ),
        },
      );
      onDone();
      onClose();
    } catch (err) {
      // All-or-nothing: a failure here means NONE of the selected content
      // was cloned, not "some of it." The program itself was already
      // created successfully before this dialog ever opened, so make clear
      // that failure is scoped to the clone step alone.
      const message = err instanceof Error ? err.message : "Failed to clone content";
      setError(`${message} Nothing was cloned — the program itself was already created.`);
      toast.error(message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !applying && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>Clone content from another program?</SheetTitle>
          <SheetDescription>
            This brand already has other programs. Copy their content into the new one, or skip
            and start empty — nothing happens until you click Clone Selected.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-6 py-6">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Source program
            </label>
            <select
              className={INPUT_CLS}
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(e.target.value || null)}
            >
              {sorted.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.year}
                </option>
              ))}
            </select>
          </div>

          {loading && <p className="text-xs text-zinc-500">Loading content counts…</p>}

          {!loading && entries.length > 0 && hasClonableContent && (
            <ul className="space-y-1 rounded-md border border-zinc-200 bg-white p-2">
              {entries.map((e) => {
                const mode = resolveMode(e);
                return (
                  <li key={e.key}>
                    <label
                      className={
                        e.count === 0
                          ? "flex cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 opacity-50"
                          : "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50"
                      }
                    >
                      <input
                        type="checkbox"
                        disabled={e.count === 0}
                        checked={checked.has(e.key)}
                        onChange={() => toggle(e.key)}
                      />
                      <span className="text-sm text-zinc-800">{e.label}</span>
                      {mode === "replace" && e.count > 0 && (
                        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                          Replace
                        </span>
                      )}
                      <span className="ml-auto text-xs text-zinc-400">{e.count}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {selectedEntries.some((e) => resolveMode(e) === "replace") && (
            <p className="text-xs text-zinc-500">
              Program Details can only be set outright, not merged — since the new program is
              empty, there is nothing on it to lose.
            </p>
          )}

          {!loading && !error && entries.length > 0 && !hasClonableContent && (
            <EmptyState
              title="Nothing to clone from this program"
              description="It has no content in any category yet. Pick a different source above, or skip."
            />
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={!canApply}
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
          >
            {applying ? "Cloning…" : "Clone Selected"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
