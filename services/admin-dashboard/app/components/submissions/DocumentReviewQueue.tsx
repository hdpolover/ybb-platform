// services/admin-dashboard/app/components/submissions/DocumentReviewQueue.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  listDocumentReviewQueue,
  reviewDocument,
  type DocumentReviewQueueItem,
  type DocumentReviewAction,
} from "@/src/shared/api-client";
import { EmptyState } from "@/src/admin/empty-state";
import { FilterSelect } from "@/src/ui/select";
import { DocumentReviewTable } from "./DocumentReviewTable";
import {
  documentReviewFilterParsers,
  DOCUMENT_REVIEW_STATUS_VALUES,
  DOCUMENT_REVIEW_PAGE_SIZE,
} from "./documentReviewFilterParsers";
import { describeReviewError } from "./documentReviewHelpers";
import { FileText } from "lucide-react";

const STATUS_LABELS: Record<(typeof DOCUMENT_REVIEW_STATUS_VALUES)[number], string> = {
  uploaded: "Awaiting Review",
  approved: "Approved",
  rejected: "Declined",
  revision_requested: "Revision Requested",
};

interface DocumentReviewQueueProps {
  programId: string;
}

export function DocumentReviewQueue({ programId }: DocumentReviewQueueProps) {
  const resolvedProgramId = useResolvedProgramId(programId);

  const [filters, setFilters] = useQueryStates(documentReviewFilterParsers);
  const { status, page } = filters;

  const [items, setItems] = useState<DocumentReviewQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listDocumentReviewQueue({
        programId: resolvedProgramId,
        status,
        limit: DOCUMENT_REVIEW_PAGE_SIZE,
        offset: (page - 1) * DOCUMENT_REVIEW_PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the review queue.");
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId, status, page]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // A filter change can shrink the result set below the current page.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / DOCUMENT_REVIEW_PAGE_SIZE));
    if (page > totalPages) {
      void setFilters({ page: totalPages });
    }
  }, [page, total, setFilters]);

  const handleStatusChange = useCallback(
    (value: (typeof DOCUMENT_REVIEW_STATUS_VALUES)[number]) => void setFilters({ status: value, page: 1 }),
    [setFilters],
  );
  const handlePageChange = useCallback((value: number) => void setFilters({ page: value }), [setFilters]);

  const handleReview = useCallback(
    async (item: DocumentReviewQueueItem, action: DocumentReviewAction, note: string) => {
      setReviewingId(item.id);
      try {
        await reviewDocument(item.applicationId, item.id, action, note || undefined);
        toast.success(
          action === "approve"
            ? "Agreement letter approved."
            : action === "reject"
              ? "Agreement letter declined."
              : "Revision requested.",
        );
        await fetchData();
      } catch (err) {
        toast.error(describeReviewError(err));
      } finally {
        setReviewingId(null);
      }
    },
    [fetchData],
  );

  if (loading) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-center py-16 text-sm text-zinc-500">Loading review queue…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="py-8 text-center text-sm text-red-600">{error}</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
          Status
          <FilterSelect
            aria-label="Review status"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as (typeof DOCUMENT_REVIEW_STATUS_VALUES)[number])}
          >
            {DOCUMENT_REVIEW_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </FilterSelect>
        </label>
      </div>
      <div className="my-5 border-t border-zinc-100" />
      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents in this status"
          description={
            status === "uploaded"
              ? "Nothing is waiting for review right now."
              : "No agreement letters currently have this status."
          }
        />
      ) : (
        <DocumentReviewTable
          items={items}
          page={page}
          pageSize={DOCUMENT_REVIEW_PAGE_SIZE}
          total={total}
          onPageChange={handlePageChange}
          onReview={handleReview}
          reviewingId={reviewingId}
        />
      )}
    </section>
  );
}
