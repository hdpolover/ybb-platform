"use client";

import React, { useEffect, useState } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { FilterSelect } from "@/src/ui/select";
import { Input } from "@/src/ui/input";

// Sort fields the backend's GET /applications endpoint actually accepts —
// mirrors ApplicationsController.SORT_BY_VALUES / ListApplicationsSortBy.
// Default (updatedAt/desc) matches the repository's un-sorted fallback order.
export const SORT_BY_OPTIONS = [
  { value: "updatedAt", label: "Last Updated" },
  { value: "createdAt", label: "Created At" },
  { value: "submittedAt", label: "Submitted At" },
  { value: "participantName", label: "Participant Name" },
  { value: "country", label: "Country" },
  { value: "status", label: "Status" },
  { value: "registrationPaymentStatus", label: "Reg. Payment" },
  { value: "programPaymentStatus", label: "Prog. Payment" },
] as const;

export const SORT_BY_VALUES = [
  "updatedAt",
  "createdAt",
  "submittedAt",
  "participantName",
  "country",
  "status",
  "registrationPaymentStatus",
  "programPaymentStatus",
] as const;

export const SORT_ORDER_OPTIONS = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
] as const;

export const SORT_ORDER_VALUES = ["desc", "asc"] as const;

export type FullyFundedSortBy = (typeof SORT_BY_VALUES)[number];
export type FullyFundedSortOrder = (typeof SORT_ORDER_VALUES)[number];

export const PAGE_SIZE_PRESETS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 500;

interface FullyFundedParticipantsFiltersProps {
  onSearch?: (value: string) => void;
  onExport?: () => void;
  exporting?: boolean;
  /** Seeds the search box from the URL-persisted value on mount. */
  initialSearch?: string;
  sortBy: FullyFundedSortBy;
  sortOrder: FullyFundedSortOrder;
  onSortByChange: (value: FullyFundedSortBy) => void;
  onSortOrderChange: (value: FullyFundedSortOrder) => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
}

export function FullyFundedParticipantsFilters({
  onSearch,
  onExport,
  exporting,
  initialSearch,
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  pageSize,
  onPageSizeChange,
}: FullyFundedParticipantsFiltersProps) {
  const [searchValue, setSearchValue] = useState(initialSearch ?? "");

  // Page-size control: a preset dropdown that swaps to a free-form number
  // input when "Custom..." is chosen. Starts in "custom" mode if the current
  // pageSize (e.g. hand-edited in the URL) isn't one of the presets.
  const isPreset = (value: number): value is (typeof PAGE_SIZE_PRESETS)[number] =>
    (PAGE_SIZE_PRESETS as readonly number[]).includes(value);
  const [pageSizeMode, setPageSizeMode] = useState<"preset" | "custom">(
    isPreset(pageSize) ? "preset" : "custom",
  );
  const [customPageSizeInput, setCustomPageSizeInput] = useState(String(pageSize));

  // Keep the custom input in sync when pageSize changes externally (e.g. the
  // debounced commit below, or a URL edit) while in custom mode.
  useEffect(() => {
    if (pageSizeMode === "custom") setCustomPageSizeInput(String(pageSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // Debounce custom page-size commits so typing "50" doesn't fire a request
  // at "5". Ignores NaN/0/negative input and clamps to [MIN, MAX] on commit.
  useEffect(() => {
    if (pageSizeMode !== "custom") return;
    const handle = setTimeout(() => {
      const parsed = Number(customPageSizeInput);
      if (!Number.isFinite(parsed) || parsed <= 0) return;
      const clamped = Math.min(Math.max(Math.floor(parsed), MIN_PAGE_SIZE), MAX_PAGE_SIZE);
      if (clamped !== pageSize) onPageSizeChange(clamped);
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customPageSizeInput, pageSizeMode]);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end md:gap-4">
        <div className="flex-1 basis-full md:basis-auto">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by name, email, account ID..."
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => onSearch?.(searchValue.trim())}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              Search
            </button>
          </div>
        </div>

        <div className="w-full md:w-48">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Form Status</label>
          <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            <option>All Status</option>
            <option>Not Started</option>
            <option>On Progress</option>
            <option>Submitted</option>
          </select>
        </div>

        <div className="w-full md:w-40">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Sort by</label>
          <FilterSelect
            aria-label="Sort by"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as FullyFundedSortBy)}
          >
            {SORT_BY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        </div>

        <div className="w-full md:w-36">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Sort order</label>
          <FilterSelect
            aria-label="Sort order"
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as FullyFundedSortOrder)}
          >
            {SORT_ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        </div>

        <div className="w-full md:w-40">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Page size</label>
          {pageSizeMode === "preset" ? (
            <FilterSelect
              aria-label="Page size"
              value={String(pageSize)}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setPageSizeMode("custom");
                  setCustomPageSizeInput(String(pageSize));
                  return;
                }
                onPageSizeChange(Number(e.target.value));
              }}
            >
              {PAGE_SIZE_PRESETS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
              <option value="custom">Custom…</option>
            </FilterSelect>
          ) : (
            <div className="space-y-1">
              <Input
                type="number"
                min={MIN_PAGE_SIZE}
                max={MAX_PAGE_SIZE}
                value={customPageSizeInput}
                onChange={(e) => setCustomPageSizeInput(e.target.value)}
                placeholder="Custom page size"
                className="h-10 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setPageSizeMode("preset");
                  onPageSizeChange(isPreset(pageSize) ? pageSize : PAGE_SIZE_PRESETS[0]);
                }}
                className="text-[11px] font-medium text-blue-600 hover:underline"
              >
                Back to presets
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSearch?.(searchValue.trim())}
            className="inline-flex flex-1 items-center justify-center rounded-md border border-blue-500 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 md:flex-none"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchValue("");
              onSearch?.("");
            }}
            className="inline-flex flex-1 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 md:flex-none"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {exporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
