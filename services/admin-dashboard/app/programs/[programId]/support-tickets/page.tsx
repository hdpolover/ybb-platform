"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  getProgramSupportTicket,
  listProgramSupportTickets,
  replyProgramSupportTicket,
  updateProgramSupportTicket,
  type ProgramSupportTicketAttachment,
  type ProgramSupportTicketDetail,
  type ProgramSupportTicketPriority,
  type ProgramSupportTicketStatus,
  type ProgramSupportTicketSummary,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { formatDateTime } from "@/lib/utils";

const STATUS_OPTIONS: ProgramSupportTicketStatus[] = [
  "open",
  "in_progress",
  "waiting_response",
  "resolved",
  "closed",
];

const PRIORITY_OPTIONS: ProgramSupportTicketPriority[] = ["low", "normal", "high", "urgent"];

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeRichHtml(value: string): string {
  if (!value.trim()) return "";
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/<(?!\/?(p|br|strong|b|em|i|u|ul|ol|li|blockquote|code|pre)\b)[^>]*>/gi, "");
}

function stripUploadedScreenshotsSection(value: string): string {
  return value
    .replace(/<p>\s*<strong>\s*Uploaded screenshots\s*<\/strong>\s*<\/p>\s*<ul>[\s\S]*?<\/ul>/i, "")
    .trim();
}

function guessMimeTypeFromUrl(url: string): string | undefined {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(url) ? "image/*" : undefined;
}

function extractScreenshotAttachments(value: string): ProgramSupportTicketAttachment[] {
  if (!value.trim()) return [];
  const normalized = value.replace(/&amp;/gi, "&");
  const matches = normalized.match(/https?:\/\/[^\s<>"')]+/gi) ?? [];
  const urls = Array.from(new Set(matches.map((url) => url.replace(/[),.;]+$/, ""))));

  return urls.map((fileUrl, index) => {
    let fileName = `Screenshot ${index + 1}`;
    try {
      const pathName = decodeURIComponent(new URL(fileUrl).pathname);
      const lastSegment = pathName.split("/").filter(Boolean).pop();
      if (lastSegment) fileName = lastSegment;
    } catch {
      // Keep default for malformed URL.
    }

    return {
      fileId: `external-${index}`,
      fileName,
      fileUrl,
      mimeType: guessMimeTypeFromUrl(fileUrl),
    };
  });
}

function CompactAttachmentGrid({ attachments }: { attachments: ProgramSupportTicketAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
      {attachments.map((attachment) => {
        const isImage =
          (attachment.mimeType ?? "").startsWith("image/") ||
          /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(attachment.fileUrl);

        if (!isImage) {
          return (
            <a
              key={attachment.fileId}
              href={attachment.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-2 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-zinc-50"
            >
              {attachment.fileName}
            </a>
          );
        }

        return (
          <a
            key={attachment.fileId}
            href={attachment.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 hover:border-zinc-300"
            title={attachment.fileName}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.fileUrl} alt={attachment.fileName} className="h-16 w-full object-cover" />
          </a>
        );
      })}
    </div>
  );
}

export default function ProgramSupportTicketsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms, assignedPrograms, accessConfig } = useAuth();

  const selectedProgram = useMemo(
    () =>
      accessiblePrograms.find(
        (program) => program.programId === params.programId || program.programSlug === params.programId,
      ),
    [accessiblePrograms, params.programId],
  );

  const programId = selectedProgram?.programId ?? params.programId;
  const programName = selectedProgram?.programName ?? "Selected Program";
  const isAssignedProgramAdmin = assignedPrograms.some((program) => program.programId === programId);
  const canManageSupportTickets = accessConfig.isSuperAdmin || isAssignedProgramAdmin;

  const [tickets, setTickets] = useState<ProgramSupportTicketSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<ProgramSupportTicketDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProgramSupportTicketStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<ProgramSupportTicketPriority | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const originalMessage = useMemo(
    () => selectedTicket?.messages.find((message) => !message.isFromAdmin),
    [selectedTicket],
  );
  const originalContent =
    selectedTicket?.description?.trim() ? selectedTicket.description : (originalMessage?.message ?? "");
  const originalDescription = useMemo(
    () => sanitizeRichHtml(stripUploadedScreenshotsSection(originalContent)),
    [originalContent],
  );
  const originalAttachments = useMemo(() => {
    const extracted = extractScreenshotAttachments(originalContent);
    const merged = new Map<string, ProgramSupportTicketAttachment>();
    const combined = [...(originalMessage?.attachments ?? []), ...extracted];

    combined.forEach((attachment, index) => {
      if (!attachment.fileUrl || merged.has(attachment.fileUrl)) return;
      merged.set(attachment.fileUrl, {
        ...attachment,
        fileId: attachment.fileId || `${attachment.fileUrl}-${index}`,
        fileName: attachment.fileName || `Screenshot ${merged.size + 1}`,
        mimeType: attachment.mimeType ?? guessMimeTypeFromUrl(attachment.fileUrl),
      });
    });

    return Array.from(merged.values());
  }, [originalContent, originalMessage?.attachments]);

  const loadTickets = useCallback(async () => {
    if (!programId) return;
    setLoadingList(true);
    setError(null);
    try {
      const response = await listProgramSupportTickets(programId, {
        page,
        limit,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: searchQuery || undefined,
      });
      setTickets(response.data ?? []);
      setTotal(response.meta?.total ?? 0);
      if (!selectedId && response.data.length > 0) {
        setSelectedId(response.data[0].id);
      }
      if (response.data.length === 0) {
        setSelectedId(null);
        setSelectedTicket(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load support tickets.");
    } finally {
      setLoadingList(false);
    }
  }, [limit, page, priorityFilter, programId, searchQuery, selectedId, statusFilter]);

  const loadTicketDetail = useCallback(async () => {
    if (!programId || !selectedId) {
      setSelectedTicket(null);
      return;
    }

    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await getProgramSupportTicket(programId, selectedId);
      setSelectedTicket(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket detail.");
      setSelectedTicket(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [programId, selectedId]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    void loadTicketDetail();
  }, [loadTicketDetail]);

  async function handleUpdateTicket() {
    if (!programId || !selectedTicket) return;
    setSavingTicket(true);
    setError(null);
    try {
      await updateProgramSupportTicket(programId, selectedTicket.id, {
        status: selectedTicket.status,
        priority: selectedTicket.priority,
      });
      await loadTickets();
      await loadTicketDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update support ticket.");
    } finally {
      setSavingTicket(false);
    }
  }

  async function handleSendReply() {
    if (!programId || !selectedTicket) return;
    const message = replyMessage.trim();
    if (!message) return;

    setSendingReply(true);
    setError(null);
    try {
      await replyProgramSupportTicket(programId, selectedTicket.id, { message });
      setReplyMessage("");
      await loadTickets();
      await loadTicketDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setSendingReply(false);
    }
  }

  if (!canManageSupportTickets) {
    return (
      <main className="space-y-4">
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
          Support ticket management is available only for assigned program admins.
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Support Tickets
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Support Tickets</h1>
        <p className="text-sm text-zinc-500">
          Program-level queue to manage participant issues, replies, and status updates.
        </p>
      </section>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-[430px_minmax(0,1fr)]">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] text-zinc-500">{total} ticket(s)</p>
            <button
              type="button"
              onClick={() => void loadTickets()}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          <div className="mb-3 grid gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by ticket number, subject, or participant"
                className="w-full rounded-md border border-zinc-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setPage(1);
                    setSearchQuery(searchInput.trim());
                  }
                }}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as ProgramSupportTicketStatus | "");
                  setPage(1);
                }}
                className="rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {toTitleCase(status)}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(event) => {
                  setPriorityFilter(event.target.value as ProgramSupportTicketPriority | "");
                  setPage(1);
                }}
                className="rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All priorities</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {toTitleCase(priority)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setSearchQuery(searchInput.trim());
                }}
                className="rounded-md bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="max-h-[640px] space-y-2 overflow-y-auto">
            {loadingList ? <p className="text-xs text-zinc-500">Loading tickets...</p> : null}
            {!loadingList && tickets.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-500">
                No support tickets found.
              </p>
            ) : null}
            {!loadingList &&
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(ticket.id);
                    setSelectedTicket(null);
                  }}
                  className={`w-full rounded-md border p-3 text-left ${
                    selectedId === ticket.id
                      ? "border-blue-400 bg-blue-50"
                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-zinc-700">{ticket.ticketNumber}</p>
                  <p className="line-clamp-1 text-sm font-semibold text-zinc-900">{ticket.subject}</p>
                  <p className="line-clamp-1 text-xs text-zinc-500">
                    {ticket.participant?.fullName ?? "Unknown participant"} · {ticket.participant?.email ?? "—"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {toTitleCase(ticket.status)} · {toTitleCase(ticket.priority)} · {formatDateTime(ticket.lastMessageAt)}
                  </p>
                </button>
              ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
              >
                Previous
              </button>
              <span className="text-[11px] text-zinc-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          {!selectedId ? <p className="text-sm text-zinc-500">Select a ticket to view details.</p> : null}
          {selectedId && loadingDetail ? <p className="text-sm text-zinc-500">Loading ticket detail...</p> : null}

          {selectedTicket ? (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {selectedTicket.ticketNumber}
                </p>
                <h3 className="text-base font-semibold text-zinc-900">{selectedTicket.subject}</h3>
                <p className="text-xs text-zinc-500">
                  {selectedTicket.participant?.fullName ?? "Unknown participant"} ·{" "}
                  {selectedTicket.participant?.email ?? "—"}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Created {formatDateTime(selectedTicket.createdAt)} · Last updated{" "}
                  {formatDateTime(selectedTicket.updatedAt)}
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-xs font-medium text-zinc-600">
                  Status
                  <select
                    value={selectedTicket.status}
                    onChange={(event) =>
                      setSelectedTicket((current) =>
                        current
                          ? {
                              ...current,
                              status: event.target.value as ProgramSupportTicketStatus,
                            }
                          : current,
                      )
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {toTitleCase(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-zinc-600">
                  Priority
                  <select
                    value={selectedTicket.priority}
                    onChange={(event) =>
                      setSelectedTicket((current) =>
                        current
                          ? {
                              ...current,
                              priority: event.target.value as ProgramSupportTicketPriority,
                            }
                          : current,
                      )
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>
                        {toTitleCase(priority)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleUpdateTicket()}
                  disabled={savingTicket}
                  className="rounded-md bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 hover:bg-blue-600"
                >
                  {savingTicket ? "Saving..." : "Save Ticket"}
                </button>
              </div>

              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-medium text-zinc-700">Original Description</p>
                <div
                  className="prose prose-sm mt-1 max-w-none text-zinc-700"
                  dangerouslySetInnerHTML={{
                    __html: originalDescription || "<p>No description provided.</p>",
                  }}
                />
                <CompactAttachmentGrid attachments={originalAttachments} />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-zinc-900">Conversation</h4>
                {selectedTicket.messages.length === 0 ? (
                  <p className="text-sm text-zinc-500">No messages yet.</p>
                ) : (
                  selectedTicket.messages.map((message, index) => {
                    const isMainThread = originalMessage
                      ? message.id === originalMessage.id
                      : !message.isFromAdmin && index === 0;
                    const messageTypeLabel = isMainThread
                      ? "Main thread"
                      : message.isFromAdmin
                        ? "Admin reply"
                        : "Participant reply";

                    return (
                      <div
                        key={message.id}
                        className={`rounded-md border p-3 ${
                          isMainThread
                            ? "border-amber-200 bg-amber-50/40"
                            : message.isFromAdmin
                              ? "border-blue-200 bg-blue-50/50"
                              : "border-zinc-200 bg-white"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">
                              {messageTypeLabel}
                            </span>
                            <p className="text-xs font-semibold text-zinc-700">
                              {message.senderName}
                              {message.isInternalNote ? " (Internal note)" : ""}
                            </p>
                          </div>
                          <p className="text-[11px] text-zinc-500">{formatDateTime(message.createdAt)}</p>
                        </div>
                        <div
                          className="prose prose-sm max-w-none text-zinc-700"
                          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(message.message) }}
                        />
                        <CompactAttachmentGrid attachments={message.attachments ?? []} />
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-600">Reply to participant</p>
                <textarea
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  placeholder="Type your response here..."
                  className="min-h-[120px] w-full rounded-md border border-zinc-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSendReply()}
                    disabled={sendingReply || !replyMessage.trim()}
                    className="rounded-md bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 hover:bg-blue-600"
                  >
                    {sendingReply ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
