"use client";

import { Button } from "@/src/ui/button";

interface BulkActionBarProps {
  count: number;
  onSend: () => void;
  onClear: () => void;
}

export function BulkActionBar({ count, onSend, onClear }: BulkActionBarProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 shadow-sm">
      <span className="text-sm font-medium text-zinc-700">
        {count} participant{count !== 1 ? "s" : ""} selected
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Button size="sm" onClick={onSend}>
          Send LoA
        </Button>
      </div>
    </div>
  );
}
