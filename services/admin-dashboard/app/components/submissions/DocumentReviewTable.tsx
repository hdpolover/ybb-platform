// services/admin-dashboard/app/components/submissions/DocumentReviewTable.tsx
"use client";

import React, { useState } from "react";
import { ArrowTopRightOnSquareIcon, CheckIcon, XMarkIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/solid";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/src/ui/dialog";
import { Button } from "@/src/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { DocumentReviewAction, DocumentReviewQueueItem, DocumentReviewStatus } from "@/src/shared/api-client";
import { canSubmitReview, reviewActionRequiresNote } from "./documentReviewHelpers";

interface DocumentReviewTableProps {
  items: DocumentReviewQueueItem[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onReview: (item: DocumentReviewQueueItem, action: DocumentReviewAction, note: string) => Promise<void>;
  /** id of the row currently submitting a review, if any. */
  reviewingId: string | null;
}

/** Decline and request-revision share this modal: both require a note, approve does not. */
interface PendingAction {
  item: DocumentReviewQueueItem;
  action: DocumentReviewAction;
}

const ACTION_COPY: Record<DocumentReviewAction, { title: string; verb: string }> = {
  approve: { title: "Approve agreement letter?", verb: "Approve" },
  reject: { title: "Decline agreement letter", verb: "Decline" },
  request_revision: { title: "Request revision", verb: "Request Revision" },
};

export function DocumentReviewTable({
  items,
  page,
  pageSize,
  total,
  onPageChange,
  onReview,
  reviewingId,
}: DocumentReviewTableProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [note, setNote] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const showingFrom = total === 0 ? 0 : startIndex + 1;
  const showingTo = total === 0 ? 0 : startIndex + items.length;

  const openAction = (item: DocumentReviewQueueItem, action: DocumentReviewAction) => {
    setNote("");
    setPending({ item, action });
  };

  const closeDialog = () => {
    setPending(null);
    setNote("");
  };

  const copy = pending ? ACTION_COPY[pending.action] : null;
  const noteRequired = pending ? reviewActionRequiresNote(pending.action) : false;
  const canSubmit = pending ? canSubmitReview(pending.action, note) : false;

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
                <th className="w-12 px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Participant</th>
                <th className="px-4 py-3 font-semibold">Programme</th>
                <th className="px-4 py-3 font-semibold">Document</th>
                <th className="px-4 py-3 font-semibold">Uploaded</th>
                <th className="px-4 py-3 font-semibold">Reviewed by</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 align-top text-xs font-medium text-zinc-500">
                    {startIndex + index + 1}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-900">{item.participantName}</span>
                      <span className="text-xs text-zinc-500">{item.participantEmail ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-700">{item.programName}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-zinc-700">{item.documentName}</span>
                      <StatusBadge status={item.submissionStatus} />
                      {item.submissionNote && (
                        <span className="max-w-xs text-[11px] text-zinc-400">Note: {item.submissionNote}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-700">
                    {item.signedCopyUploadedAt ? formatDateTime(item.signedCopyUploadedAt) : "—"}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-zinc-700">
                    {item.reviewedByName ? (
                      <div className="flex flex-col">
                        <span>{item.reviewedByName}</span>
                        <span className="text-[11px] text-zinc-400">
                          {item.reviewedAt ? formatDateTime(item.reviewedAt) : ""}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1.5">
                      {item.signedCopyUrl && (
                        <a
                          href={item.signedCopyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View uploaded file"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </a>
                      )}
                      {item.submissionStatus === "uploaded" && (
                        <>
                          <button
                            type="button"
                            title="Approve"
                            disabled={reviewingId === item.id}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => openAction(item, "approve")}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Decline"
                            disabled={reviewingId === item.id}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition-colors hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => openAction(item, "reject")}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Request revision"
                            disabled={reviewingId === item.id}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => openAction(item, "request_revision")}
                          >
                            <ArrowUturnLeftIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs font-medium text-zinc-500">
        <span>
          Showing {showingFrom} to {showingTo} of {total} entries
        </span>
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>
              {pending &&
                `${pending.item.participantName}, ${pending.item.documentName}. ${
                  noteRequired
                    ? "The note below is shown to the participant verbatim."
                    : "The participant will be notified that their document was approved."
                }`}
            </DialogDescription>
          </DialogHeader>
          {noteRequired && (
            <label className="block text-xs font-semibold text-zinc-600">
              Note <span className="text-rose-600">*</span>
              <textarea
                className="mt-1 w-full rounded-md border border-zinc-200 p-2 text-sm font-normal text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Explain what needs to change, shown to the participant."
              />
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={async () => {
                if (!pending) return;
                const { item, action } = pending;
                const submittedNote = note.trim();
                closeDialog();
                await onReview(item, action, submittedNote);
              }}
            >
              {copy?.verb}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentReviewStatus }) {
  const styles: Record<DocumentReviewStatus, string> = {
    uploaded: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-50 text-rose-700 border-rose-200",
    revision_requested: "bg-blue-50 text-blue-700 border-blue-200",
  };
  const labels: Record<DocumentReviewStatus, string> = {
    uploaded: "Awaiting Review",
    approved: "Approved",
    rejected: "Declined",
    revision_requested: "Revision Requested",
  };

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
