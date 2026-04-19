"use client";

import { PlusIcon, TrashIcon, Bars3Icon } from "@heroicons/react/24/outline";

export type OptionRow = { label: string; value: string };

interface OptionsRepeaterProps {
  value: OptionRow[];
  onChange: (next: OptionRow[]) => void;
}

/**
 * Visual replacement for the `Options JSON` textarea. Renders one row per
 * option with a label + value input, plus add / delete / move controls.
 * Admins only see free-text inputs — no JSON syntax to get wrong.
 *
 * `label` is what the applicant sees (e.g. "Small"); `value` is what gets
 * stored when they pick it (e.g. "S"). We default `value` to a slugged copy
 * of `label` when blank so most admins never need to touch it.
 */
export function OptionsRepeater({ value, onChange }: OptionsRepeaterProps) {
  function slugify(label: string): string {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_+|_+$)/g, "");
  }

  function updateRow(index: number, patch: Partial<OptionRow>) {
    const next = value.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function addRow() {
    onChange([...value, { label: "", value: "" }]);
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function moveRow(from: number, to: number) {
    if (to < 0 || to >= value.length) return;
    const next = value.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-500">
          No options yet. Add the choices you want applicants to pick from.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((row, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2"
            >
              <div className="flex flex-col items-center justify-center pt-1 text-zinc-400">
                <button
                  type="button"
                  onClick={() => moveRow(index, index - 1)}
                  disabled={index === 0}
                  className="disabled:opacity-30"
                  title="Move up"
                >
                  <Bars3Icon className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    Label
                  </label>
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      // If the admin hadn't customized the value, keep it in sync
                      const shouldSyncValue = !row.value || row.value === slugify(row.label);
                      updateRow(index, {
                        label,
                        value: shouldSyncValue ? slugify(label) : row.value,
                      });
                    }}
                    placeholder="e.g. Small"
                    className="block w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    Value (stored)
                  </label>
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateRow(index, { value: e.target.value })}
                    placeholder={row.label ? slugify(row.label) : "e.g. s"}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
                title="Remove option"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add option
      </button>
    </div>
  );
}
