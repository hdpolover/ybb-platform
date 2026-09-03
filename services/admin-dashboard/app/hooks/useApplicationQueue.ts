// services/admin-dashboard/app/hooks/useApplicationQueue.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { listApplications, type Application } from "@/src/shared/api-client";
import { fullyFundedFilterParsers } from "@/app/components/scoring/fullyFundedFilterParsers";
import { MIN_PAGE_SIZE, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from "@/app/components/scoring/FullyFundedParticipantsFilters";

interface UseApplicationQueueOptions {
  /** Resolved program UUID (see useResolvedProgramId) -- required for the list call. */
  resolvedProgramId: string;
  /** The application id of the applicant currently open in the split view. */
  currentApplicationId: string;
  /**
   * Called immediately before Prev/Next actually navigates away. Return
   * false to cancel (e.g. the reviewer has unsaved changes and declined to
   * discard them). Optional -- when omitted, navigation always proceeds.
   */
  confirmNavigate?: () => boolean;
}

interface UseApplicationQueueResult {
  loading: boolean;
  error: string | null;
  /** Total applicants matching the reviewer's current filters, across all pages. */
  total: number;
  /** 1-based position of the current applicant within the filtered queue.
   *  Null when the current applicant isn't on the page the URL says it should
   *  be (e.g. a direct link with stale/mismatched filters) -- in that case
   *  Prev/Next are disabled rather than guessing. */
  position: number | null;
  hasPrev: boolean;
  hasNext: boolean;
  /** True while resolving+navigating to an adjacent applicant (crossing a page boundary awaits a fetch). */
  navigating: boolean;
  /** skipConfirm bypasses confirmNavigate -- used for the auto-advance-after-submit path, see resolveAndGo. */
  goToPrev: (options?: { skipConfirm?: boolean }) => void;
  goToNext: (options?: { skipConfirm?: boolean }) => void;
}

type PageResult = { data: Application[]; total: number };

/** Clamps a URL-sourced page size the same way the list page does. */
function clampPageSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.floor(value), MIN_PAGE_SIZE), MAX_PAGE_SIZE);
}

/**
 * Drives the review queue's Previous/Next navigation over the exact same
 * filtered, sorted, paginated list the reviewer was looking at in the
 * fully-funded participants table -- same nuqs parsers, same listApplications
 * call. Never fetches the whole result set: only the reviewer's current page
 * is loaded up front, and an adjacent page is fetched on demand (and cached
 * for the session) only when the reviewer actually crosses a page boundary.
 */
export function useApplicationQueue({
  resolvedProgramId,
  currentApplicationId,
  confirmNavigate,
}: UseApplicationQueueOptions): UseApplicationQueueResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters] = useQueryStates(fullyFundedFilterParsers);
  const { search, status, scoreStatus, registrationPaymentStatus, sortBy, sortOrder, page } = filters;
  const pageSize = clampPageSize(filters.pageSize);

  const filterKey = JSON.stringify({
    resolvedProgramId,
    search,
    status,
    scoreStatus,
    registrationPaymentStatus,
    sortBy,
    sortOrder,
    pageSize,
  });

  // Per-filterKey page cache so hopping back and forth across a page
  // boundary doesn't refetch pages already seen this session.
  const cacheRef = useRef<{ key: string; pages: Map<number, PageResult> }>({
    key: filterKey,
    pages: new Map(),
  });
  if (cacheRef.current.key !== filterKey) {
    cacheRef.current = { key: filterKey, pages: new Map() };
  }

  const [homePage, setHomePage] = useState<PageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const fetchPage = useCallback(
    async (pageNum: number): Promise<PageResult | null> => {
      const cached = cacheRef.current.pages.get(pageNum);
      if (cached) return cached;
      if (!resolvedProgramId) return null;
      const res = await listApplications({
        programId: resolvedProgramId,
        category: "fully_funded",
        status: status === "all" ? undefined : status,
        scoreStatus: scoreStatus === "all" ? undefined : scoreStatus,
        registrationPaymentStatus: registrationPaymentStatus === "all" ? undefined : registrationPaymentStatus,
        search: search || undefined,
        sortBy,
        sortOrder,
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      });
      const result: PageResult = { data: res.data, total: res.total };
      cacheRef.current.pages.set(pageNum, result);
      return result;
    },
    [resolvedProgramId, search, status, scoreStatus, registrationPaymentStatus, sortBy, sortOrder, pageSize],
  );

  useEffect(() => {
    if (!resolvedProgramId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(page)
      .then((result) => {
        if (cancelled) return;
        setHomePage(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load the review queue.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedProgramId, filterKey, page, fetchPage]);

  const indexInHomePage = homePage?.data.findIndex((a) => a.id === currentApplicationId) ?? -1;
  const position = homePage && indexInHomePage !== -1 ? (page - 1) * pageSize + indexInHomePage + 1 : null;
  const total = homePage?.total ?? 0;
  const hasPrev = position != null && position > 1;
  const hasNext = position != null && position < total;

  const navigateToApplication = useCallback(
    (targetId: string, targetPage: number) => {
      // Every route this hook is used from ends in /<applicationId> -- swap
      // just that last segment rather than assuming the prefix.
      const nextPath = pathname.replace(/\/[^/]+$/, `/${encodeURIComponent(targetId)}`);
      const nextParams = new URLSearchParams(searchParams.toString());
      if (targetPage !== page) {
        nextParams.set("page", String(targetPage));
      }
      const query = nextParams.toString();
      router.push(query ? `${nextPath}?${query}` : nextPath);
    },
    [pathname, router, searchParams, page],
  );

  const resolveAndGo = useCallback(
    async (direction: "prev" | "next", skipConfirm: boolean) => {
      if (navigating || !homePage || indexInHomePage === -1) return;
      // skipConfirm is set for the auto-advance-after-successful-submit path --
      // there is nothing unsaved right after a submit, but the parent's dirty
      // flag (driven by an effect) hasn't necessarily re-rendered yet, so we
      // don't want a stale "you have unsaved changes" prompt firing right
      // after the reviewer just saved.
      if (!skipConfirm && confirmNavigate && !confirmNavigate()) return;

      setNavigating(true);
      try {
        if (direction === "prev") {
          if (indexInHomePage > 0) {
            navigateToApplication(homePage.data[indexInHomePage - 1].id, page);
            return;
          }
          if (page <= 1) return;
          const prevPage = await fetchPage(page - 1);
          if (!prevPage || prevPage.data.length === 0) return;
          navigateToApplication(prevPage.data[prevPage.data.length - 1].id, page - 1);
        } else {
          if (indexInHomePage < homePage.data.length - 1) {
            navigateToApplication(homePage.data[indexInHomePage + 1].id, page);
            return;
          }
          const totalPages = Math.max(1, Math.ceil(homePage.total / pageSize));
          if (page >= totalPages) return;
          const nextPage = await fetchPage(page + 1);
          if (!nextPage || nextPage.data.length === 0) return;
          navigateToApplication(nextPage.data[0].id, page + 1);
        }
      } finally {
        setNavigating(false);
      }
    },
    [navigating, homePage, indexInHomePage, confirmNavigate, page, pageSize, fetchPage, navigateToApplication],
  );

  const goToPrev = useCallback(
    (options?: { skipConfirm?: boolean }) => void resolveAndGo("prev", options?.skipConfirm ?? false),
    [resolveAndGo],
  );
  const goToNext = useCallback(
    (options?: { skipConfirm?: boolean }) => void resolveAndGo("next", options?.skipConfirm ?? false),
    [resolveAndGo],
  );

  return { loading, error, total, position, hasPrev, hasNext, navigating, goToPrev, goToNext };
}
