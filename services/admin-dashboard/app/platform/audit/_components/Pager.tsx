// services/admin-dashboard/app/platform/audit/_components/Pager.tsx
import { Button } from "@/src/ui/button";

type PagerProps = { page: number; totalPages: number; total: number; onPage: (page: number) => void };

export function Pager({ page, totalPages, total, onPage }: PagerProps) {
  if (totalPages <= 1) {
    return <p className="text-xs text-zinc-500">{total.toLocaleString()} result{total === 1 ? "" : "s"}</p>;
  }
  return (
    <div className="flex items-center justify-between text-xs text-zinc-600">
      <span>
        Page {page} of {totalPages} · {total.toLocaleString()} results
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
