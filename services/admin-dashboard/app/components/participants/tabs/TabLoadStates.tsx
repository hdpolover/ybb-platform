// services/admin-dashboard/app/components/participants/tabs/TabLoadStates.tsx
import React from "react";
import { AlertCircle } from "lucide-react";
import { EmptyState } from "@/src/admin/empty-state";
import { Skeleton } from "@/src/ui/skeleton";

const SKELETON_ROWS = 3;

/** Loading placeholder for a lazily fetched participant tab. */
export function TabSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

/** Fetch failure with a retry button; reuses EmptyState so it sits like the other tab states. */
export function TabError({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={error instanceof Error ? error.message : "Something went wrong. Please try again."}
      action={{ label: "Retry", onClick: onRetry }}
    />
  );
}
