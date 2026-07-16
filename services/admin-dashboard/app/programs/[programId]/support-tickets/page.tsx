"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import {
  deleteProgramSupportTicket,
  getProgramSupportTicket,
  listProgramSupportTickets,
  replyProgramSupportTicket,
  updateProgramSupportTicket,
  uploadFileViaPresignedUrl,
  type ProgramSupportTicketAttachment,
  type ProgramSupportTicketDetail,
  type ProgramSupportTicketPriority,
  type ProgramSupportTicketStatus,
  type ProgramSupportTicketSummary,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { Skeleton } from "@/src/ui/skeleton";
import { FilterSelect } from "@/src/ui/select";
import { FilterField } from "@/src/ui/filter-grid";
import { FilterPanel, type FilterPanelActiveFilter } from "@/src/ui/filter-panel";
import { TicketStatusTabs } from "@/app/components/support/TicketStatusTabs";
import { TicketListItem } from "@/app/components/support/TicketListItem";
import { TicketDetailHeader } from "@/app/components/support/TicketDetailHeader";
import { TicketConversation } from "@/app/components/support/TicketConversation";
import { ReplyComposer } from "@/app/components/support/ReplyComposer";
import {
  extractScreenshotAttachments,
  guessMimeTypeFromUrl,
  sanitizeRichHtml,
  stripUploadedScreenshotsSection,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  toTitleCase,
} from "@/app/components/support/types";

// URL-persisted filter state (nuqs) — mirrors the pattern in
// app/programs/[programId]/payments/page.tsx. Keys are distinct from the
// `ticket` param (read separately via useSearchParams below) to avoid collision.
const supportTicketsFilterParsers = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  status: parseAsStringEnum(["", ...STATUS_OPTIONS]).withDefault("").withOptions({ clearOnDefault: true }),
  priority: parseAsStringEnum(["", ...PRIORITY_OPTIONS]).withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
};

export default function SupportTicketsPage() {
  const params = useParams<{ programId: string }>();
  const searchParams = useSearchParams();
  const ticketParam = searchParams.get("ticket");

  const { adminProfile, accessiblePrograms, assignedPrograms, accessConfig } = useAuth();

  const selectedProgram = useMemo(
    () =>
      accessiblePrograms.find(
        (program) =>
          program.programId === params.programId || program.programSlug === params.programId,
      ),
    [accessiblePrograms, params.programId],
  );
  const programId = selectedProgram?.programId ?? params.programId;
  const programName = selectedProgram?.programName ?? "Selected Program";
  const isAssignedProgramAdmin = assignedPrograms.some(
    (program) => program.programId === programId,
  );
  const canManageSupportTickets = accessConfig.isSuperAdmin || isAssignedProgramAdmin;

  const [tickets, setTickets] = useState<ProgramSupportTicketSummary[]>([]);
  const [tabCounts, setTabCounts] = useState<Record<ProgramSupportTicketStatus | "all", number>>({
    all: 0,
    open: 0,
    in_progress: 0,
    waiting_response: 0,
    resolved: 0,
    closed: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(ticketParam);
  const [selectedTicket, setSelectedTicket] = useState<ProgramSupportTicketDetail | null>(null);
  const [localTicket, setLocalTicket] = useState<ProgramSupportTicketDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All filters live in the URL via nuqs (batched updates -> single history write per change).
  const [filters, setFilters] = useQueryStates(supportTicketsFilterParsers);
  const { search: searchQuery, status: statusFilter, priority: priorityFilter, page } = filters;

  // Local input state for the search box so typing feels instant; synced to
  // the nuqs-backed `search` filter on a short debounce so we don't write to
  // the URL (and refetch) on every keystroke.
  const [searchInput, setSearchInput] = useState(searchQuery);
  const lastSyncedSearch = useRef(searchQuery);

  useEffect(() => {
    if (searchQuery !== lastSyncedSearch.current) {
      lastSyncedSearch.current = searchQuery;
      setSearchInput(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== searchQuery) {
        lastSyncedSearch.current = searchInput;
        void setFilters({ search: searchInput || null, page: 1 });
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const hasActiveFilters = Boolean(searchQuery || statusFilter || priorityFilter);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    lastSyncedSearch.current = "";
    void setFilters({ search: null, status: null, priority: null, page: null });
  }, [setFilters]);

  // Chip keys that belong to the always-visible "primary" filters (Status,
  // Priority) rather than the collapsible advanced panel — used to derive
  // `advancedFilterCount` below without double-counting. This page has no
  // other filterable fields, so the advanced panel is always empty/0.
  const PRIMARY_CHIP_KEYS = useMemo(() => new Set(["status", "priority"]), []);

  const activeFilters: FilterPanelActiveFilter[] = useMemo(() => {
    const chips: FilterPanelActiveFilter[] = [];
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${toTitleCase(statusFilter)}`,
        onRemove: () => void setFilters({ status: null, page: 1 }),
      });
    }
    if (priorityFilter) {
      chips.push({
        key: "priority",
        label: `Priority: ${toTitleCase(priorityFilter)}`,
        onRemove: () => void setFilters({ priority: null, page: 1 }),
      });
    }
    return chips;
  }, [statusFilter, priorityFilter, setFilters]);

  const advancedFilterCount = useMemo(
    () => activeFilters.filter((filter) => !PRIMARY_CHIP_KEYS.has(filter.key)).length,
    [activeFilters, PRIMARY_CHIP_KEYS],
  );

  const [total, setTotal] = useState(0);
  const limit = 20;

  // Ref to avoid stale closure in loadTickets callback.
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (ticketParam) setSelectedId(ticketParam);
  }, [ticketParam]);

  const originalMessage = useMemo(
    () => selectedTicket?.messages.find((message) => !message.isFromAdmin),
    [selectedTicket],
  );
  const originalContent =
    selectedTicket?.description?.trim()
      ? selectedTicket.description
      : (originalMessage?.message ?? "");
  const originalDescription = useMemo(
    () => sanitizeRichHtml(stripUploadedScreenshotsSection(originalContent)),
    [originalContent],
  );
  const originalAttachments = useMemo<ProgramSupportTicketAttachment[]>(() => {
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

  const loadCounts = useCallback(async () => {
    if (!programId) return;
    const [
      allResult,
      openResult,
      inProgressResult,
      waitingResult,
      resolvedResult,
      closedResult,
    ] = await Promise.all([
      listProgramSupportTickets(programId, { limit: 1 }),
      listProgramSupportTickets(programId, { limit: 1, status: "open" }),
      listProgramSupportTickets(programId, { limit: 1, status: "in_progress" }),
      listProgramSupportTickets(programId, { limit: 1, status: "waiting_response" }),
      listProgramSupportTickets(programId, { limit: 1, status: "resolved" }),
      listProgramSupportTickets(programId, { limit: 1, status: "closed" }),
    ]);
    setTabCounts({
      all: allResult.meta?.total ?? 0,
      open: openResult.meta?.total ?? 0,
      in_progress: inProgressResult.meta?.total ?? 0,
      waiting_response: waitingResult.meta?.total ?? 0,
      resolved: resolvedResult.meta?.total ?? 0,
      closed: closedResult.meta?.total ?? 0,
    });
  }, [programId]);

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
      if (!selectedIdRef.current && response.data.length > 0) {
        setSelectedId(response.data[0].id);
      }
      if (response.data.length === 0) {
        setSelectedId(null);
        setSelectedTicket(null);
        setLocalTicket(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load support tickets.");
    } finally {
      setLoadingList(false);
    }
  }, [limit, page, priorityFilter, programId, searchQuery, statusFilter]);

  const loadTicketDetail = useCallback(async () => {
    if (!programId || !selectedId) {
      setSelectedTicket(null);
      setLocalTicket(null);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await getProgramSupportTicket(programId, selectedId);
      setSelectedTicket(detail);
      setLocalTicket(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket detail.");
      setSelectedTicket(null);
      setLocalTicket(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [programId, selectedId]);

  async function handleUpdateTicket(patch?: {
    status?: ProgramSupportTicketStatus;
    priority?: ProgramSupportTicketPriority;
    assignedTo?: string | null;
    resolution?: string | null;
    closedReason?: string | null;
  }) {
    if (!programId || !selectedTicket || !localTicket) return;
    setSavingTicket(true);
    setError(null);
    const update = {
      status: patch?.status ?? localTicket.status,
      priority: patch?.priority ?? localTicket.priority,
      assignedTo: patch?.assignedTo !== undefined ? patch.assignedTo : localTicket.assignedTo,
      resolution: patch?.resolution !== undefined ? patch.resolution : localTicket.resolution,
      closedReason:
        patch?.closedReason !== undefined ? patch.closedReason : localTicket.closedReason,
    };
    setLocalTicket((prev) => (prev ? { ...prev, ...update } : prev));
    try {
      await updateProgramSupportTicket(programId, selectedTicket.id, update);
      await loadTickets();
      await loadTicketDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ticket.");
    } finally {
      setSavingTicket(false);
    }
  }

  async function handleSendReply(
    message: string,
    isInternalNote: boolean,
    attachmentFiles: File[],
  ) {
    if (!programId || !selectedTicket) return;
    setError(null);
    let uploadedAttachments: ProgramSupportTicketAttachment[] = [];
    if (attachmentFiles.length > 0) {
      setUploadingAttachments(true);
      try {
        const results = await Promise.all(
          attachmentFiles.map((file) =>
            uploadFileViaPresignedUrl(file, {
              userId: adminProfile?.userId ?? "",
              brandId: selectedProgram?.brandId ?? "",
              programId,
              assetType: "support-attachment",
              bucket: "documents",
            }),
          ),
        );
        uploadedAttachments = results.map((result, index) => ({
          fileId: result.fileId,
          fileName: attachmentFiles[index].name,
          fileUrl: result.publicUrl ?? "",
          mimeType: attachmentFiles[index].type,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload attachments.");
        setUploadingAttachments(false);
        return;
      } finally {
        setUploadingAttachments(false);
      }
    }
    setSendingReply(true);
    try {
      await replyProgramSupportTicket(programId, selectedTicket.id, {
        message,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        isInternalNote,
      });
      await loadTickets();
      await loadTicketDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setSendingReply(false);
    }
  }

  async function handleDeleteTicket() {
    if (!programId || !selectedTicket) return;
    setDeletingTicket(true);
    setError(null);
    try {
      await deleteProgramSupportTicket(programId, selectedTicket.id);
      setSelectedId(null);
      setSelectedTicket(null);
      setLocalTicket(null);
      setShowDeleteConfirm(false);
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete support ticket.");
    } finally {
      setDeletingTicket(false);
    }
  }

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    void loadTicketDetail();
  }, [loadTicketDetail]);

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
      {/* Header */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Support Tickets
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Support Tickets</h1>
        <p className="text-sm text-zinc-500">
          Program-level queue to manage participant issues, replies, and status updates.
        </p>
      </section>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      {/* Status tabs */}
      <TicketStatusTabs
        counts={tabCounts}
        activeStatus={statusFilter}
        onStatusChange={(status) => {
          void setFilters({ status: status || null, page: 1 });
        }}
      />

      {/* Two-pane layout */}
      <section className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* LEFT: list panel */}
        <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          {/* Toolbar */}
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

          {/* Search + filters */}
          <div className="mb-3">
            <FilterPanel
              search={{
                value: searchInput,
                onChange: setSearchInput,
                placeholder: "Search tickets...",
              }}
              primary={
                <>
                  <div className="w-full">
                    <FilterSelect
                      aria-label="Status"
                      value={statusFilter}
                      onChange={(e) => {
                        void setFilters({
                          status: (e.target.value || null) as typeof statusFilter | null,
                          page: 1,
                        });
                      }}
                    >
                      <option value="">All statuses</option>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {toTitleCase(status)}
                        </option>
                      ))}
                    </FilterSelect>
                  </div>
                  <div className="w-full">
                    <FilterSelect
                      aria-label="Priority"
                      value={priorityFilter}
                      onChange={(e) => {
                        void setFilters({
                          priority: (e.target.value || null) as typeof priorityFilter | null,
                          page: 1,
                        });
                      }}
                    >
                      <option value="">All priorities</option>
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                          {toTitleCase(priority)}
                        </option>
                      ))}
                    </FilterSelect>
                  </div>
                </>
              }
              advancedCount={advancedFilterCount}
              activeFilters={activeFilters}
              resultCount={total}
              onClear={clearFilters}
              clearDisabled={!hasActiveFilters}
            />
          </div>

          {/* Ticket list */}
          <div className="max-h-[600px] flex-1 space-y-2 overflow-y-auto">
            {loadingList
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-zinc-100 p-3 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              : null}
            {!loadingList && tickets.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-500">
                No support tickets found.
              </p>
            ) : null}
            {!loadingList &&
              (() => {
                const now = Date.now();
                const staleMs = 3 * 24 * 60 * 60 * 1000;
                return tickets.map((ticket) => (
                  <TicketListItem
                    key={ticket.id}
                    ticket={ticket}
                    isSelected={selectedId === ticket.id}
                    isStale={
                      ticket.status === "open" &&
                      now - new Date(ticket.createdAt).getTime() > staleMs
                    }
                    onClick={() => {
                      setSelectedId(ticket.id);
                      setSelectedTicket(null);
                      setLocalTicket(null);
                    }}
                  />
                ));
              })()}
          </div>

          {/* Pagination */}
          {Math.ceil(total / limit) > 1 ? (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => void setFilters({ page: page - 1 })}
                className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
              >
                Previous
              </button>
              <span className="text-[11px] text-zinc-600">
                Page {page} of {Math.ceil(total / limit)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(total / limit)}
                onClick={() => void setFilters({ page: page + 1 })}
                className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>

        {/* RIGHT: detail panel */}
        <div className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          {!selectedId && !loadingDetail ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-400">
              Select a ticket to view details.
            </div>
          ) : null}
          {selectedId && loadingDetail ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ) : null}
          {selectedTicket && localTicket ? (
            <div className="flex flex-col h-full min-h-0">
              <div className="flex-shrink-0 border-b border-zinc-200 p-4">
                <TicketDetailHeader
                  ticket={selectedTicket}
                  localTicket={localTicket}
                  setLocalTicket={(updater) =>
                    setLocalTicket((prev) => (prev ? updater(prev) : prev))
                  }
                  adminId={adminProfile?.id}
                  onUpdate={handleUpdateTicket}
                  isSaving={savingTicket}
                  onDelete={() => void handleDeleteTicket()}
                  showDeleteConfirm={showDeleteConfirm}
                  setShowDeleteConfirm={setShowDeleteConfirm}
                  isDeletingTicket={deletingTicket}
                  participantHref={
                    selectedTicket.participant?.id
                      ? `/programs/${params.programId}/participants/${selectedTicket.participant.id}`
                      : null
                  }
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <TicketConversation
                  ticket={selectedTicket}
                  originalDescription={originalDescription}
                  originalAttachments={originalAttachments}
                />
              </div>
              <div className="flex-shrink-0 border-t border-zinc-200 p-4">
                <ReplyComposer
                  onSend={handleSendReply}
                  isSending={sendingReply}
                  isUploading={uploadingAttachments}
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
