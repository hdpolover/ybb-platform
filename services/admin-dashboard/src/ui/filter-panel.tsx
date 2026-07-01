// src/ui/filter-panel.tsx
import * as React from "react";
import { Search, SlidersHorizontal, FilterX, X } from "lucide-react";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";

/**
 * Shared progressive-disclosure filter shell for list pages: a search box
 * plus a small set of always-visible "primary" filters, with everything
 * else tucked behind a "Filters" toggle so the page doesn't open with a
 * wall of dropdowns. Removable chips surface whichever filters are
 * currently active, even while the advanced panel is collapsed.
 *
 * Renders internal layout only — no outer card/white-box wrapper. The
 * consuming page is expected to wrap this in its existing card shell
 * (see `app/programs/[programId]/payments/page.tsx` for the reference
 * usage).
 */

export interface FilterPanelSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface FilterPanelActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface FilterPanelProps {
  search: FilterPanelSearchProps;
  /** Always-visible primary filter controls (e.g. Status, Method selects). */
  primary: React.ReactNode;
  /** Collapsible advanced controls — consumer supplies and lays these out. */
  advanced: React.ReactNode;
  /** Count of currently active advanced filters, shown as a badge on the toggle. */
  advancedCount?: number;
  /** Removable chips summarizing currently active filters. */
  activeFilters?: FilterPanelActiveFilter[];
  resultCount?: number;
  onClear: () => void;
  clearDisabled?: boolean;
}

export function FilterPanel({
  search,
  primary,
  advanced,
  advancedCount = 0,
  activeFilters = [],
  resultCount,
  onClear,
  clearDisabled,
}: FilterPanelProps) {
  const searchId = React.useId();
  // Auto-open the advanced panel on mount when it already has active filters
  // hidden inside it, so nothing active is ever invisible to the user.
  const [advancedOpen, setAdvancedOpen] = React.useState(() => advancedCount > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <label htmlFor={searchId} className="sr-only">
            {search.placeholder ?? "Search"}
          </label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            id={searchId}
            placeholder={search.placeholder}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            className="h-10 pl-8 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">{primary}</div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((open) => !open)}
          className="h-10 shrink-0"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {advancedCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white">
              {advancedCount}
            </span>
          )}
        </Button>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
            >
              {filter.label}
              <button
                type="button"
                onClick={filter.onRemove}
                aria-label={`Remove filter: ${filter.label}`}
                className="rounded-full text-zinc-400 transition-colors hover:text-zinc-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {advancedOpen && (
        <div className="mt-3 border-t border-zinc-200 pt-3">{advanced}</div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-400">
          {resultCount !== undefined ? `${resultCount} result${resultCount !== 1 ? "s" : ""}` : ""}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={clearDisabled}
          className="h-8 text-xs"
        >
          <FilterX className="mr-1.5 h-3.5 w-3.5" />
          Clear filters
        </Button>
      </div>
    </div>
  );
}
