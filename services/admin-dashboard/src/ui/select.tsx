import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Optional label rendered above the control, associated via htmlFor/id. */
  label?: string;
}

/**
 * Polished native <select>. Renders a real <select> (no Radix) with a
 * custom chevron indicator, consistent h-10 sizing, and optional label.
 * Accepts <option> children — same authoring pattern used across the app.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;

    const control = (
      <div className="relative w-full">
        <select
          id={selectId}
          ref={ref}
          className={cn(
            "h-10 w-full appearance-none rounded-md border border-zinc-200 bg-white px-3 pr-9 text-sm text-zinc-700 shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          aria-hidden="true"
        />
      </div>
    );

    if (!label) return control;

    return (
      <div className="space-y-1">
        <label htmlFor={selectId} className="block text-[11px] font-medium text-zinc-500">
          {label}
        </label>
        {control}
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
// Alias for the filter-page convention (`FilterSelect` composed inside `FilterGrid`).
export { Select as FilterSelect };
