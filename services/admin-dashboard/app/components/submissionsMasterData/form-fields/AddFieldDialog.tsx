"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { fetchSystemFormFields, type SystemFormField } from "./catalog-api";
import { SystemFieldConfigSheet } from "./SystemFieldConfigSheet";
import { FormFieldEditor } from "./FormFieldEditor";

type Mode = "picker" | "system" | "custom";

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Identity",
  program_structure: "Program Structure",
  professional: "Professional",
  logistics: "Logistics",
  misc: "Misc",
};

const CATEGORY_ORDER = [
  "identity",
  "program_structure",
  "professional",
  "logistics",
  "misc",
];

interface AddFieldDialogProps {
  open: boolean;
  programId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AddFieldDialog({
  open,
  programId,
  onClose,
  onSaved,
}: AddFieldDialogProps) {
  const [mode, setMode] = useState<Mode>("picker");
  const [catalog, setCatalog] = useState<SystemFormField[]>([]);
  const [query, setQuery] = useState("");
  const [selectedSystem, setSelectedSystem] = useState<SystemFormField | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("picker");
    setQuery("");
    setSelectedSystem(null);
    setError(null);
    setLoading(true);
    fetchSystemFormFields()
      .then((rows) => setCatalog(rows.filter((r) => r.isActive)))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load catalog"),
      )
      .finally(() => setLoading(false));
  }, [open]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? catalog.filter(
          (f) => f.label.toLowerCase().includes(q) || f.key.includes(q),
        )
      : catalog;
    const byCategory = new Map<string, SystemFormField[]>();
    for (const f of filtered) {
      if (!byCategory.has(f.category)) byCategory.set(f.category, []);
      byCategory.get(f.category)!.push(f);
    }
    // Keep known categories in prescribed order, then any unknown ones alphabetically.
    const unknown = [...byCategory.keys()]
      .filter((c) => !CATEGORY_ORDER.includes(c))
      .sort();
    return [...CATEGORY_ORDER, ...unknown]
      .filter((c) => byCategory.has(c))
      .map((c) => [c, byCategory.get(c)!] as const);
  }, [catalog, query]);

  // Delegate to child sheets/editor when a mode other than picker is active.
  if (mode === "system" && selectedSystem) {
    return (
      <SystemFieldConfigSheet
        open
        programId={programId}
        systemField={selectedSystem}
        onClose={() => {
          setMode("picker");
          setSelectedSystem(null);
        }}
        onSaved={() => {
          onSaved();
          setMode("picker");
          setSelectedSystem(null);
          onClose();
        }}
      />
    );
  }

  if (mode === "custom") {
    return (
      <FormFieldEditor
        open
        programId={programId}
        initialField={null}
        onClose={() => setMode("picker")}
        onSaved={() => {
          onSaved();
          setMode("picker");
          onClose();
        }}
      />
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>Add Form Field</SheetTitle>
          <SheetDescription>
            Choose a field from the catalog, or create a custom one for
            anything not in the list.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-6">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Search — e.g. email, subtheme, t-shirt…"
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          {loading && (
            <p className="text-xs text-zinc-500">Loading catalog…</p>
          )}

          <div className="space-y-5">
            {grouped.map(([category, fields]) => (
              <section key={category}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {CATEGORY_LABELS[category] ?? category}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {fields.map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => {
                        setSelectedSystem(f);
                        setMode("system");
                      }}
                      className={
                        f.isMagic
                          ? "rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left transition hover:border-blue-400 hover:bg-blue-100"
                          : "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
                      }
                    >
                      <div
                        className={
                          f.isMagic
                            ? "text-sm font-semibold text-blue-900"
                            : "text-sm font-semibold text-zinc-900"
                        }
                      >
                        {f.label}
                        {f.isMagic ? " ⚙️" : ""}
                      </div>
                      <div
                        className={
                          f.isMagic
                            ? "text-[11px] text-blue-700"
                            : "text-[11px] text-zinc-500"
                        }
                      >
                        {f.type} ·{" "}
                        {f.isMagic ? "system · auto-synced" : "built-in"}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            {!loading && grouped.length === 0 && (
              <p className="text-sm text-zinc-500">
                No system fields match your search.
              </p>
            )}
          </div>

          <div className="border-t border-dashed border-zinc-200 pt-4">
            <button
              type="button"
              onClick={() => setMode("custom")}
              className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              ＋ Create custom field
            </button>
            <p className="mt-1.5 text-center text-[11px] text-zinc-500">
              For questions not covered by the catalog above.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
