// services/admin-dashboard/app/platform/audit/_components/AuditEntryDrawer.tsx
"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { Button } from "@/src/ui/button";
import { EmptyState } from "@/src/admin/empty-state";
import { formatDateTime } from "@/lib/utils";
import { adminLabel, type AdminOption } from "@/lib/audit-log";
import { listEntityAuditHistory, type AuditLogEntry } from "@/src/shared/api-client";
import { ActionBadge } from "./ActionBadge";
import { DiffView } from "./DiffView";

const HISTORY_LIMIT = 50;
const SECONDS = { second: "2-digit" } as const;

type Props = {
  entry: AuditLogEntry | null;
  admins: ReadonlyMap<string, AdminOption>;
  onClose: () => void;
};

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 break-words text-xs text-zinc-800">{children}</dd>
    </div>
  );
}

// Mount with key={entry.id}: a different row starts from fresh state (no stale history).
export function AuditEntryDrawer({ entry, admins, onClose }: Props) {
  const [current, setCurrent] = useState<AuditLogEntry | null>(entry);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openHistory() {
    if (!current?.entityId) return;
    setHistoryOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await listEntityAuditHistory(current.entityType, current.entityId, 1, HISTORY_LIMIT);
      setHistory(res.data);
      setHistoryTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load record history");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DrawerShell
      open={entry !== null}
      onClose={onClose}
      title={current ? `${current.action.replace(/_/g, " ")} · ${current.entityType}` : "Change"}
      description={current ? formatDateTime(current.createdAt, SECONDS) : undefined}
      error={error}
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {current && (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <Meta label="Admin">{adminLabel(admins, current.actorId)}</Meta>
            <Meta label="Action"><ActionBadge action={current.action} /></Meta>
            <Meta label="Entity">{current.entityType}</Meta>
            <Meta label="Entity id"><span className="font-mono">{current.entityId ?? "—"}</span></Meta>
            <Meta label="Endpoint">{[current.httpMethod, current.endpoint].filter(Boolean).join(" ") || "—"}</Meta>
            <Meta label="IP address">{current.ipAddress ?? "—"}</Meta>
            <Meta label="Risk">{current.riskLevel}</Meta>
            <Meta label="Status">{current.status ?? "—"}</Meta>
            {current.reason && <Meta label="Reason">{current.reason}</Meta>}
            {current.errorMessage && <Meta label="Error">{current.errorMessage}</Meta>}
          </dl>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900">Changes</h3>
            <DiffView before={current.beforeState} after={current.afterState} />
          </section>

          {current.entityId && (
            <section className="space-y-2">
              {!historyOpen ? (
                <Button variant="link" className="h-auto p-0 text-xs" onClick={() => void openHistory()}>
                  All changes to this record
                </Button>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    All changes to this record{historyTotal > 0 ? ` (${historyTotal})` : ""}
                  </h3>
                  {loading ? (
                    <p className="text-xs text-zinc-500">Loading…</p>
                  ) : history.length === 0 ? (
                    <EmptyState icon={History} title="No other changes" className="py-6" />
                  ) : (
                    <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
                      {history.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            onClick={() => setCurrent(h)}
                            aria-current={h.id === current.id}
                            className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50 aria-[current=true]:bg-blue-50"
                          >
                            <span className="min-w-0 truncate">
                              {formatDateTime(h.createdAt, SECONDS)} · {adminLabel(admins, h.actorId)}
                            </span>
                            <ActionBadge action={h.action} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </DrawerShell>
  );
}
