"use client";

import { PlusIcon, TrashIcon, LinkIcon, PlayCircleIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";

export type HelpAssetKind = "link" | "video" | "file";

export type HelpAssetRow = {
  kind: HelpAssetKind;
  label: string;
  url: string;
};

export const HELP_ASSETS_MAX = 5;

interface HelpAssetsRepeaterProps {
  value: HelpAssetRow[];
  onChange: (next: HelpAssetRow[]) => void;
}

const KIND_OPTIONS: { value: HelpAssetKind; label: string }[] = [
  { value: "link", label: "Link" },
  { value: "video", label: "Video" },
  { value: "file", label: "File / Template" },
];

function KindIcon({ kind }: { kind: HelpAssetKind }) {
  if (kind === "video") return <PlayCircleIcon className="h-4 w-4 text-zinc-500" />;
  if (kind === "file") return <DocumentArrowDownIcon className="h-4 w-4 text-zinc-500" />;
  return <LinkIcon className="h-4 w-4 text-zinc-500" />;
}

/**
 * Lets admins attach a small set of guidance items to a form field
 * (example link, tutorial video, downloadable template). Each item renders
 * on the applicant's form as a labeled pill that opens the URL in a new tab.
 */
export function HelpAssetsRepeater({ value, onChange }: HelpAssetsRepeaterProps) {
  const atCap = value.length >= HELP_ASSETS_MAX;

  function updateRow(index: number, patch: Partial<HelpAssetRow>) {
    const next = value.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function addRow() {
    if (atCap) return;
    onChange([...value, { kind: "link", label: "", url: "" }]);
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-500">
          No guidance items yet. Add an example link, tutorial video, or downloadable template to help applicants.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((row, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2"
            >
              <div className="pt-6 pr-1">
                <KindIcon kind={row.kind} />
              </div>
              <div className="flex-1 grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,2fr)]">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    Kind
                  </label>
                  <select
                    value={row.kind}
                    onChange={(e) => updateRow(index, { kind: e.target.value as HelpAssetKind })}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    Label
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={row.label}
                    onChange={(e) => updateRow(index, { label: e.target.value })}
                    placeholder="e.g. Example twibbon"
                    className="block w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    URL
                  </label>
                  <input
                    type="url"
                    inputMode="url"
                    value={row.url}
                    onChange={(e) => updateRow(index, { url: e.target.value })}
                    placeholder="https://…"
                    className="block w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
                title="Remove item"
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
        disabled={atCap}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        {atCap ? `Max ${HELP_ASSETS_MAX} items` : "Add guidance item"}
      </button>
    </div>
  );
}
