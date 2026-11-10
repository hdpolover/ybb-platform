"use client";

import React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { FilterSelect } from "@/src/ui/select";
import {
  SORT_BY_OPTIONS,
  SORT_ORDER_OPTIONS,
  type FullyFundedSortBy,
  type FullyFundedSortOrder,
} from "./FullyFundedParticipantsFilters";

// Subset of the shared sort options that make sense for the interview tab.
const INTERVIEW_SORT_VALUES: readonly FullyFundedSortBy[] = [
  "scoreTotal",
  "participantName",
  "country",
  "scoreStatus",
  "createdAt",
];
const INTERVIEW_SORT_BY_OPTIONS = SORT_BY_OPTIONS.filter((option) =>
  INTERVIEW_SORT_VALUES.includes(option.value),
);

interface InterviewParticipantsHeaderProps {
  onSearch?: (value: string) => void;
  sortBy: FullyFundedSortBy;
  sortOrder: FullyFundedSortOrder;
  onSortByChange: (value: FullyFundedSortBy) => void;
  onSortOrderChange: (value: FullyFundedSortOrder) => void;
}

export function InterviewParticipantsHeader({
  onSearch,
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
}: InterviewParticipantsHeaderProps) {
  const [value, setValue] = React.useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSearch?.(value.trim());
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
      <div className="mb-3">
        <h1 className="text-base font-semibold text-zinc-900">Participants go to Interview</h1>
        <p className="mt-0.5 text-[12px] text-zinc-500">
          List of shortlisted participants for the interview stage.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Search by name, email, account ID, nationality..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-600"
          >
            <MagnifyingGlassIcon className="h-3.5 w-3.5" />
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <div className="w-full md:w-44">
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Sort by</label>
            <FilterSelect
              aria-label="Sort by"
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as FullyFundedSortBy)}
            >
              {INTERVIEW_SORT_BY_OPTIONS.map((option) => (
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
        </div>
      </form>
    </section>
  );
}
