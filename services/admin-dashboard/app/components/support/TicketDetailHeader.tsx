"use client";

import type {
  ProgramSupportTicketDetail,
  ProgramSupportTicketPriority,
  ProgramSupportTicketStatus,
} from "@/src/shared/api-client";
import { formatDateTime } from "@/lib/utils";
import { STATUS_CONFIG, STATUS_OPTIONS, PRIORITY_CONFIG, PRIORITY_OPTIONS } from "./types";

interface TicketDetailHeaderProps {
  ticket: ProgramSupportTicketDetail;
  adminId: string | undefined;
  onUpdate: (patch: {
    status?: ProgramSupportTicketStatus;
    priority?: ProgramSupportTicketPriority;
    assignedTo?: string | null;
    resolution?: string | null;
    closedReason?: string | null;
  }) => Promise<void>;
  isSaving: boolean;
  onDelete: () => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  isDeletingTicket: boolean;
  localTicket: ProgramSupportTicketDetail;
  setLocalTicket: (updater: (prev: ProgramSupportTicketDetail) => ProgramSupportTicketDetail) => void;
}

export function TicketDetailHeader({
  ticket,
  adminId,
  onUpdate,
  isSaving,
  onDelete,
  showDeleteConfirm,
  setShowDeleteConfirm,
  isDeletingTicket,
  localTicket,
  setLocalTicket,
}: TicketDetailHeaderProps) {
  const statusCfg = STATUS_CONFIG[localTicket.status];
  const priorityCfg = PRIORITY_CONFIG[localTicket.priority];

  const handleSave = () => {
    void onUpdate({
      status: localTicket.status,
      priority: localTicket.priority,
      assignedTo: localTicket.assignedTo,
      resolution: localTicket.resolution,
      closedReason: localTicket.closedReason,
    });
  };

  const handleAssignToMe = () => {
    if (!adminId) return;
    setLocalTicket((prev) => ({ ...prev, assignedTo: adminId }));
  };

  const handleUnassign = () => {
    setLocalTicket((prev) => ({ ...prev, assignedTo: null }));
  };

  return (
    <div className="space-y-3">
      {/* Ticket meta row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {ticket.ticketNumber}
          </p>
          <h2 className="mt-0.5 text-base font-bold text-zinc-900 leading-snug">
            {ticket.subject}
          </h2>
          {ticket.participant ? (
            <p className="mt-0.5 text-xs text-zinc-500">
              {ticket.participant.fullName}{" "}
              <span className="text-zinc-400">({ticket.participant.email})</span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-zinc-400">No participant linked</p>
          )}
          <p className="mt-1 text-[10px] text-zinc-400">
            Created {formatDateTime(ticket.createdAt)} &middot; Updated {formatDateTime(ticket.updatedAt)}
          </p>
        </div>

        {/* Delete button */}
        <div className="flex items-center gap-2">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-600 font-medium">Delete this ticket?</span>
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeletingTicket}
                className="rounded-md bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isDeletingTicket ? "Deleting..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Status + Priority row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Status
          </label>
          <select
            value={localTicket.status}
            onChange={(e) =>
              setLocalTicket((prev) => ({
                ...prev,
                status: e.target.value as ProgramSupportTicketStatus,
              }))
            }
            className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
          <span
            className={`inline-block text-[10px] font-medium text-${statusCfg.badgeVariant === "info" ? "blue" : statusCfg.badgeVariant === "pending" ? "sky" : statusCfg.badgeVariant === "warning" ? "amber" : statusCfg.badgeVariant === "success" ? "emerald" : "zinc"}-600`}
          >
            {statusCfg.label}
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Priority
          </label>
          <select
            value={localTicket.priority}
            onChange={(e) =>
              setLocalTicket((prev) => ({
                ...prev,
                priority: e.target.value as ProgramSupportTicketPriority,
              }))
            }
            className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_CONFIG[p].label}
              </option>
            ))}
          </select>
          <span
            className={`inline-block text-[10px] font-medium text-${priorityCfg.badgeVariant === "destructive" ? "red" : priorityCfg.badgeVariant === "warning" ? "amber" : priorityCfg.badgeVariant === "info" ? "blue" : "zinc"}-600`}
          >
            {priorityCfg.label}
          </span>
        </div>

        <div className="col-span-2 space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Assigned To
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={localTicket.assignedTo ?? ""}
              onChange={(e) =>
                setLocalTicket((prev) => ({
                  ...prev,
                  assignedTo: e.target.value || null,
                }))
              }
              placeholder="Admin ID or unassigned"
              className="flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {adminId ? (
              localTicket.assignedTo === adminId ? (
                <button
                  type="button"
                  onClick={handleUnassign}
                  className="shrink-0 rounded-md border border-zinc-200 px-2 py-1.5 text-[10px] font-medium text-zinc-500 hover:bg-zinc-50"
                >
                  Unassign
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAssignToMe}
                  className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
                >
                  Assign to me
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* Resolution textarea (when resolved) */}
      {localTicket.status === "resolved" ? (
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Resolution Note
          </label>
          <textarea
            rows={2}
            value={localTicket.resolution ?? ""}
            onChange={(e) =>
              setLocalTicket((prev) => ({
                ...prev,
                resolution: e.target.value || null,
              }))
            }
            placeholder="Describe how this ticket was resolved..."
            className="w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      ) : null}

      {/* Close reason textarea (when closed) */}
      {localTicket.status === "closed" ? (
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Close Reason
          </label>
          <textarea
            rows={2}
            value={localTicket.closedReason ?? ""}
            onChange={(e) =>
              setLocalTicket((prev) => ({
                ...prev,
                closedReason: e.target.value || null,
              }))
            }
            placeholder="Reason for closing this ticket..."
            className="w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      ) : null}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-md bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
