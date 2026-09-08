// app/programs/[programId]/reminders/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";
import { MailWarning, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import {
  cancelParticipantReminder,
  getParticipantReminder,
  getReminderAudience,
  listParticipantReminders,
  type ParticipantReminder,
  type ParticipantReminderDetail,
  type ParticipantReminderStatus,
  type ReminderAudiencePreview,
} from "@/src/shared/api-client";
import { Badge } from "@/src/ui/badge";
import { Button } from "@/src/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";
import { EmptyState } from "@/src/admin/empty-state";
import { PageHeader } from "@/src/admin/page-header";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { FilterSelect } from "@/src/ui/select";
import { FilterPanel } from "@/src/ui/filter-panel";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { ReminderAudienceCard } from "@/app/components/reminders/ReminderAudienceCard";
import { ReminderDialog } from "@/app/components/reminders/ReminderDialog";
import { ReminderDeliveryDialog } from "@/app/components/reminders/ReminderDeliveryDialog";
import { formatWib } from "@/app/components/reminders/wib-time";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred";
}

const STATUS_VARIANT: Record<
  ParticipantReminder["status"],
  "secondary" | "info" | "warning" | "success" | "destructive"
> = {
  draft: "secondary",
  scheduled: "info",
  sending: "warning",
  sent: "success",
  cancelled: "destructive",
};

const STATUS_LABEL: Record<ParticipantReminder["status"], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

const STATUS_OPTIONS: ParticipantReminderStatus[] = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
];

const LIST_LIMIT = 20;

// URL-persisted filter state (nuqs) — mirrors the pattern in
// app/programs/[programId]/support-tickets/page.tsx.
const remindersFilterParsers = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  status: parseAsStringEnum(["", ...STATUS_OPTIONS])
    .withDefault("")
    .withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
};

/**
 * "N sent / M failed" once outcomes have been reported. Deliberately never
 * renders a bare "0 sent" for a reminder that has not run — that would read as
 * a failed send rather than as a message still waiting for its time.
 */
function DeliveryCell({
  reminder,
  onView,
}: {
  reminder: ParticipantReminder;
  onView: (reminder: ParticipantReminder) => void;
}) {
  if (reminder.status === "draft" || reminder.status === "scheduled") {
    return <span className="text-sm text-zinc-400">—</span>;
  }
  if (reminder.status === "cancelled") {
    return <span className="text-sm text-zinc-400">Never sent</span>;
  }
  if (reminder.audienceCount === 0) {
    return <span className="text-sm text-zinc-500">Nobody owed — sent to 0</span>;
  }

  const { sent, failed, pending } = reminder.summary;
  return (
    <button
      type="button"
      onClick={() => onView(reminder)}
      className="cursor-pointer text-sm underline underline-offset-2"
    >
      <span className="tabular-nums text-emerald-700">{sent} sent</span>
      {failed > 0 && <span className="tabular-nums text-red-700"> / {failed} failed</span>}
      {pending > 0 && <span className="tabular-nums text-zinc-500"> / {pending} pending</span>}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramRemindersPage() {
  const params = useParams<{ programId: string }>();
  const resolvedProgramId = useResolvedProgramId(params.programId);

  const [reminders, setReminders] = useState<ParticipantReminder[]>([]);
  const [total, setTotal] = useState(0);
  const [audience, setAudience] = useState<ReminderAudiencePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [audienceLoading, setAudienceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ParticipantReminder | undefined>(undefined);

  const [cancelTarget, setCancelTarget] = useState<ParticipantReminder | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [delivery, setDelivery] = useState<ParticipantReminderDetail | null>(null);

  // All filters live in the URL via nuqs (batched updates -> single history write per change).
  const [filters, setFilters] = useQueryStates(remindersFilterParsers);
  const { search: searchQuery, status: statusFilter, page } = filters;
  const totalPages = Math.max(1, Math.ceil(total / LIST_LIMIT));

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

  const hasActiveFilters = Boolean(searchQuery || statusFilter);
  const clearFilters = useCallback(() => {
    setSearchInput("");
    lastSyncedSearch.current = "";
    void setFilters({ search: null, status: null, page: null });
  }, [setFilters]);

  const activeFilters = useMemo(() => {
    if (!statusFilter) return [];
    return [
      {
        key: "status",
        label: `Status: ${STATUS_LABEL[statusFilter]}`,
        onRemove: () => void setFilters({ status: null, page: 1 }),
      },
    ];
  }, [statusFilter, setFilters]);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listParticipantReminders(resolvedProgramId, {
        page,
        limit: LIST_LIMIT,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setReminders(response.data ?? []);
      setTotal(response.meta?.total ?? 0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId, page, statusFilter, searchQuery]);

  /**
   * The audience is supplementary to the list, so it is fetched separately and
   * a failure here must never take the reminder table down with it.
   */
  const fetchAudience = useCallback(async () => {
    setAudienceLoading(true);
    try {
      setAudience(await getReminderAudience(resolvedProgramId));
    } catch {
      setAudience(null);
    } finally {
      setAudienceLoading(false);
    }
  }, [resolvedProgramId]);

  useEffect(() => {
    void fetchReminders();
    void fetchAudience();
  }, [fetchReminders, fetchAudience]);

  function handleNew() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function handleEdit(reminder: ParticipantReminder) {
    setEditing(reminder);
    setDialogOpen(true);
  }

  function handleSaved() {
    setDialogOpen(false);
    setEditing(undefined);
    void fetchReminders();
    void fetchAudience();
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelParticipantReminder(resolvedProgramId, cancelTarget.id);
      toast.success("Reminder cancelled. It will not send.");
      setCancelTarget(null);
      void fetchReminders();
    } catch (err) {
      // A 409 here means the dispatcher claimed it first — the admin needs to
      // know the send is genuinely under way, not that the click failed.
      toast.error(getErrorMessage(err));
      void fetchReminders();
    } finally {
      setCancelling(false);
    }
  }

  async function handleViewDelivery(reminder: ParticipantReminder) {
    try {
      setDelivery(await getParticipantReminder(resolvedProgramId, reminder.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reminders"
        description="Draft a reminder, see exactly who will receive it, and pick when it goes out. Nothing sends automatically."
        actions={
          <Button size="sm" onClick={handleNew}>
            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
            New Reminder
          </Button>
        }
      />

      <ReminderAudienceCard audience={audience} loading={audienceLoading} />

      <FilterPanel
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Search by subject...",
        }}
        primary={
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
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </FilterSelect>
          </div>
        }
        activeFilters={activeFilters}
        resultCount={total}
        onClear={clearFilters}
        clearDisabled={!hasActiveFilters}
      />

      {loading && (
        <div className="flex items-center justify-center py-16">
          <span className="text-sm text-zinc-400">Loading reminders…</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void fetchReminders()}
          >
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && reminders.length === 0 && (
        <EmptyState
          icon={MailWarning}
          title={hasActiveFilters ? "No reminders match these filters" : "No reminders yet"}
          description={
            hasActiveFilters
              ? "Try clearing the search or status filter."
              : "Draft a message to an audience of participants, then pick a send time."
          }
          action={
            hasActiveFilters
              ? { label: "Clear filters", onClick: clearFilters }
              : { label: "Create First Reminder", onClick: handleNew }
          }
        />
      )}

      {!loading && !error && reminders.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Send Time (WIB)</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Email Delivery</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reminders.map((reminder) => {
              const editable =
                reminder.status === "draft" || reminder.status === "scheduled";
              return (
                <TableRow key={reminder.id}>
                  <TableCell className="max-w-[18rem] truncate font-medium">
                    {reminder.subject}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">
                    {formatWib(reminder.scheduledAt)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {reminder.audienceCount ?? "—"}
                  </TableCell>
                  <TableCell>
                    <DeliveryCell reminder={reminder} onView={handleViewDelivery} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[reminder.status]}>
                      {STATUS_LABEL[reminder.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(reminder)}
                        disabled={!editable}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setCancelTarget(reminder)}
                        disabled={!editable}
                      >
                        Cancel
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => void setFilters({ page: page - 1 })}
          >
            Previous
          </Button>
          <span className="text-xs text-zinc-600">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => void setFilters({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      )}

      {dialogOpen && (
        <ReminderDialog
          programId={resolvedProgramId}
          reminder={editing}
          onClose={() => {
            setDialogOpen(false);
            setEditing(undefined);
          }}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel this reminder?"
        description="It will not send. You can create a new one at any time."
        confirmLabel="Cancel reminder"
        cancelLabel="Keep it"
        loading={cancelling}
        onConfirm={handleCancelConfirm}
      />

      {delivery && (
        <ReminderDeliveryDialog delivery={delivery} onClose={() => setDelivery(null)} />
      )}
    </div>
  );
}
