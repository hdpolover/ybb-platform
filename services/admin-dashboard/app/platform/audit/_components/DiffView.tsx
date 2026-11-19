// services/admin-dashboard/app/platform/audit/_components/DiffView.tsx
// Log state is untrusted: everything below renders as React text inside <pre>, never as HTML.
import { ScrollText } from "lucide-react";
import { EmptyState } from "@/src/admin/empty-state";
import { diffStates, formatJson, type DiffRow } from "@/lib/audit-log";

function Value({ value, tone }: { value: unknown; tone: "before" | "after" | "plain" }) {
  const toneClass = {
    before: "bg-red-50 text-red-900",
    after: "bg-emerald-50 text-emerald-900",
    plain: "bg-zinc-50 text-zinc-700",
  }[tone];
  return (
    <pre className={`max-h-64 overflow-auto whitespace-pre-wrap break-words rounded px-2 py-1.5 font-mono text-[11px] ${toneClass}`}>
      {formatJson(value)}
    </pre>
  );
}

function ChangedRow({ row }: { row: DiffRow }) {
  return (
    <li className="rounded-md border border-zinc-200 p-3" data-testid="diff-changed">
      <p className="mb-2 break-all font-mono text-xs font-semibold text-zinc-900">{row.key}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-700">Before</p>
          <Value value={row.before} tone="before" />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">After</p>
          <Value value={row.after} tone="after" />
        </div>
      </div>
    </li>
  );
}

export function DiffView({ before, after }: { before: unknown; after: unknown }) {
  const rows = diffStates(before, after);
  const changed = rows.filter((r) => r.changed);
  const unchanged = rows.filter((r) => !r.changed);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No state captured"
        description="This change was logged without a before/after snapshot."
        className="py-8"
      />
    );
  }

  return (
    <div className="space-y-3">
      {changed.length === 0 ? (
        <p className="text-xs text-zinc-500">No field values differ between the two snapshots.</p>
      ) : (
        <ul className="space-y-3">
          {changed.map((r) => (
            <ChangedRow key={r.key} row={r} />
          ))}
        </ul>
      )}
      {unchanged.length > 0 && (
        <details className="rounded-md border border-zinc-200">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-600">
            {unchanged.length} unchanged field{unchanged.length === 1 ? "" : "s"}
          </summary>
          <ul className="space-y-2 border-t border-zinc-100 p-3">
            {unchanged.map((r) => (
              <li key={r.key}>
                <p className="mb-1 break-all font-mono text-[11px] font-semibold text-zinc-600">{r.key}</p>
                <Value value={r.after} tone="plain" />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
