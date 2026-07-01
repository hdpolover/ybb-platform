// app/components/revenue/UnbackfilledBanner.tsx
import { Info } from "lucide-react";

interface UnbackfilledBannerProps {
  count: number;
}

/**
 * Informational (not error/warning) banner shown when some paid invoices
 * have no fee/net data yet, so the incomplete figures don't get misread as
 * settled zeros. Intentionally blue/neutral, not red/amber.
 */
export function UnbackfilledBanner({ count }: UnbackfilledBannerProps) {
  if (count <= 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {count} paid invoice{count !== 1 ? "s" : ""} {count !== 1 ? "have" : "has"} no fee/net data yet.
        Gross figures are complete; fee and net totals will update once these invoices are backfilled.
      </span>
    </div>
  );
}
