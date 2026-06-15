"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  getLoaStatus,
  sendLoa,
  type DocumentTemplate,
  type LoaStatusRow,
} from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";

interface LoaStatusTableProps {
  programId: string;
  template: DocumentTemplate | null;
}

export function LoaStatusTable({ programId, template }: LoaStatusTableProps) {
  const [rows, setRows] = useState<LoaStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState<string | null>(null); // participantId being resent

  const load = useCallback(async () => {
    if (!template) return;
    setLoading(true);
    try {
      const data = await getLoaStatus(programId, template.id);
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load LoA status");
    } finally {
      setLoading(false);
    }
  }, [programId, template]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleResend(participantId: string) {
    if (!template) return;
    setResending(participantId);
    try {
      await sendLoa(programId, template.id, { participantId, resend: true });
      toast.success("LoA re-sent");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resend failed");
    } finally {
      setResending(null);
    }
  }

  if (!template) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">LoA Send Status</h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {rows.length === 0 && !loading ? (
        <div className="py-12 text-center text-sm text-zinc-400">
          No LoAs generated yet. Use &quot;Generate &amp; Send&quot; above to start.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
              <th className="px-4 py-2.5 text-left">Participant</th>
              <th className="px-4 py-2.5 text-left">Document No.</th>
              <th className="px-4 py-2.5 text-left">Generated</th>
              <th className="px-4 py-2.5 text-left">Emailed</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.documentId} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{row.participantName}</div>
                  <div className="text-xs text-zinc-400">{row.email}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                  {row.documentNumber ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {formatDate(row.generatedAt)}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {row.emailedAt ? formatDate(row.emailedAt) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      row.status === "emailed"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700",
                    ].join(" ")}
                  >
                    {row.status === "emailed" ? "Emailed" : "Generated"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={row.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      PDF
                    </a>
                    <button
                      type="button"
                      disabled={resending === row.participantId}
                      onClick={() => void handleResend(row.participantId)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-40"
                      title="Re-send email"
                    >
                      <Send className="h-3 w-3" />
                      {resending === row.participantId ? "Sending..." : "Resend"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
