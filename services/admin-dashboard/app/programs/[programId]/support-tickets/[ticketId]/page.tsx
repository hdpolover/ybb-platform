"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getProgramSupportTicket,
  replyProgramSupportTicket,
  updateProgramSupportTicket,
  type ProgramSupportTicket,
  type ProgramSupportTicketDetail,
} from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";

const STATUS_OPTIONS: ProgramSupportTicket["status"][] = [
  "open",
  "in_progress",
  "waiting_response",
  "resolved",
  "closed",
];

const PRIORITY_OPTIONS: ProgramSupportTicket["priority"][] = ["low", "normal", "high", "urgent"];

export default function ProgramSupportTicketDetailPage() {
  const params = useParams<{ programId: string; ticketId: string }>();
  const [ticket, setTicket] = useState<ProgramSupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [resolution, setResolution] = useState("");

  const load = useCallback(async () => {
    if (!params.programId || !params.ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProgramSupportTicket(params.programId, params.ticketId);
      setTicket(data);
      setResolution(data.resolution ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load support ticket.");
    } finally {
      setLoading(false);
    }
  }, [params.programId, params.ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatusChange(nextStatus: ProgramSupportTicket["status"]) {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProgramSupportTicket(params.programId, ticket.id, { status: nextStatus });
      setTicket((current) => (current ? { ...current, status: updated.status, updatedAt: updated.updatedAt } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update support ticket.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePriorityChange(nextPriority: ProgramSupportTicket["priority"]) {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProgramSupportTicket(params.programId, ticket.id, { priority: nextPriority });
      setTicket((current) =>
        current ? { ...current, priority: updated.priority, updatedAt: updated.updatedAt } : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update support ticket.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResolutionSave() {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProgramSupportTicket(params.programId, ticket.id, {
        resolution: resolution.trim() || null,
      });
      setTicket((current) =>
        current ? { ...current, resolution: updated.resolution ?? null, updatedAt: updated.updatedAt } : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save resolution.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReplySubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ticket || !replyText.trim()) return;
    setReplying(true);
    setError(null);
    try {
      const message = await replyProgramSupportTicket(params.programId, ticket.id, {
        message: replyText.trim(),
      });
      setTicket((current) =>
        current
          ? {
              ...current,
              messages: [...current.messages, message],
              updatedAt: message.createdAt,
            }
          : current,
      );
      setReplyText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setReplying(false);
    }
  }

  if (loading) {
    return (
      <main className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm">
        Loading support ticket…
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="space-y-3">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? "Support ticket not found."}
        </p>
        <Link href={`/programs/${params.programId}/support-tickets`} className="text-sm text-blue-600 hover:underline">
          Back to support tickets
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Support Ticket</p>
            <h1 className="text-lg font-bold text-zinc-900">
              {ticket.ticketNumber} · {ticket.subject}
            </h1>
          </div>
          <Link href={`/programs/${params.programId}/support-tickets`} className="text-sm text-blue-600 hover:underline">
            Back to list
          </Link>
        </div>

        {error ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-[11px] text-zinc-500">Participant</p>
            <p className="text-sm font-medium text-zinc-800">{ticket.participantName ?? "Participant"}</p>
            <p className="text-sm text-zinc-600">{ticket.participantEmail ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-[11px] text-zinc-500">Category</p>
            <p className="text-sm font-medium text-zinc-800">{ticket.category}</p>
            {ticket.subCategory ? <p className="text-sm text-zinc-600">{ticket.subCategory}</p> : null}
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-zinc-600">
            Status
            <select
              value={ticket.status}
              onChange={(event) => void handleStatusChange(event.target.value as ProgramSupportTicket["status"])}
              disabled={saving}
              className="mt-1 block w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-zinc-600">
            Priority
            <select
              value={ticket.priority}
              onChange={(event) => void handlePriorityChange(event.target.value as ProgramSupportTicket["priority"])}
              disabled={saving}
              className="mt-1 block w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            >
              {PRIORITY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block text-xs font-medium text-zinc-600">
          Resolution
          <textarea
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Add resolution details for this ticket"
          />
        </label>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => void handleResolutionSave()}
            disabled={saving}
            className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 hover:bg-blue-600"
          >
            {saving ? "Saving..." : "Save Resolution"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Conversation</h2>
        <p className="mb-3 text-xs text-zinc-500">Created {formatDate(ticket.createdAt)}</p>

        <div className="space-y-2">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Ticket Description</p>
            <p className="mt-1 text-sm text-zinc-700">{ticket.description}</p>
          </div>
          {ticket.messages.length === 0 ? (
            <p className="text-sm text-zinc-500">No replies yet.</p>
          ) : (
            ticket.messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-md border p-3 ${
                  message.isFromAdmin ? "border-blue-200 bg-blue-50/50" : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-zinc-700">{message.senderName}</p>
                  <p className="text-[11px] text-zinc-500">{formatDate(message.createdAt)}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{message.message}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={(event) => void handleReplySubmit(event)} className="mt-4 space-y-2">
          <label className="block text-xs font-medium text-zinc-600">
            Reply as admin
            <textarea
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              rows={3}
              required
              className="mt-1 block w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Type your reply to the participant"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={replying || !replyText.trim()}
              className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 hover:bg-blue-600"
            >
              {replying ? "Sending..." : "Send Reply"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
