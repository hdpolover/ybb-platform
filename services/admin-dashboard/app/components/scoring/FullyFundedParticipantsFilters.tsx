"use client";

import React, { useState } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

interface FullyFundedParticipantsFiltersProps {
  onSearch?: (value: string) => void;
  onExport?: () => void;
  exporting?: boolean;
}

export function FullyFundedParticipantsFilters({
  onSearch,
  onExport,
  exporting,
}: FullyFundedParticipantsFiltersProps) {
  const [searchValue, setSearchValue] = useState("");

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-4">
        <div className="flex-1">
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
