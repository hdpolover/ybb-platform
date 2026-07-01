import * as React from "react";
import { FilterX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/ui/button";

/**
 * Shared filter-page layout primitives. Composable, not hardcoded to a
 * field count — each page decides how many `FilterGrid` rows it needs and
 * what goes in them (search input, `FilterSelect`, date inputs, etc).
 *
 * Naming note: an unrelated `FilterBar` already exists at
 * `src/admin/filter-bar.tsx` (a flex search+filters+refresh row used by a
 * couple of platform pages). To avoid confusion with that component, the
 * responsive grid layout introduced here is named `FilterGrid`.
 */

interface FilterGridProps {
  children: React.ReactNode;
  /** Override the responsive column count, e.g. "lg:grid-cols-7". */
  className?: string;
}

/** Responsive grid row for aligning filter controls at even heights/gaps. */
export function FilterGrid({ children, className }: FilterGridProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

interface FilterFieldProps {
  label?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

/** Label + control wrapper for consistent filter label typography/spacing. */
export function FilterField({ label, htmlFor, children, className }: FilterFieldProps) {
  if (!label) return <>{children}</>;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="block text-[11px] font-medium text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  );
}

interface FilterActionsProps {
  resultCount?: number;
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}

/** Result-count text + "Clear filters" action, consistent across filter pages. */
export function FilterActions({ resultCount, onClear, disabled, className }: FilterActionsProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span className="text-xs text-zinc-400">
        {resultCount !== undefined ? `${resultCount} result${resultCount !== 1 ? "s" : ""}` : ""}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClear}
        disabled={disabled}
        className="h-8 text-xs"
      >
        <FilterX className="mr-1.5 h-3.5 w-3.5" />
        Clear filters
      </Button>
    </div>
  );
}
