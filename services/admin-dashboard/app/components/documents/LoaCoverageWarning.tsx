// app/components/documents/LoaCoverageWarning.tsx
"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/src/ui/button";
import { formatDate } from "@/lib/utils";
import type { UncoveredParticipant } from "@/src/shared/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoaCoverageWarningProps {
  /** True total — `participants` is capped at 100 by the API. */
  count: number;
  participants: UncoveredParticipant[];
  /** How many of `count` an existing UNRELEASED batch would cover. */
  coveredByUnreleasedBatchCount: number;
  unreleasedBatchNames: string[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Surfaces the silent-exclusion blind spot: applicants whose payment date
 * falls outside every RELEASED batch window are never selected for the
 * LOA-ready email and leave no send record at all, so without this they
 * simply vanish. Overlapping batch ranges are rejected on create, so the gap
 * cannot be closed by widening an existing batch — it needs a new one.
 */
export function LoaCoverageWarning({
  count,
  participants,
  coveredByUnreleasedBatchCount,
  unreleasedBatchNames,
}: LoaCoverageWarningProps) {
  const [expanded, setExpanded] = useState(false);

  if (count === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-amber-900">
            {count} participant{count === 1 ? "" : "s"} not covered by any released batch
          </p>
          <p className="text-sm text-amber-800">
            Their payment date falls outside every released window, so they were never
            sent an Invitation Letter email and have no delivery record. Create a batch
            covering their payment dates and release it.
          </p>
          {coveredByUnreleasedBatchCount > 0 && (
            <p className="text-sm text-amber-800">
              {coveredByUnreleasedBatchCount} of them would be covered by{" "}
              {unreleasedBatchNames.length === 1 ? "the batch" : "batches"}{" "}
              <span className="font-medium">{unreleasedBatchNames.join(", ")}</span>, which{" "}
              {unreleasedBatchNames.length === 1 ? "is" : "are"} still a draft — releasing{" "}
              {unreleasedBatchNames.length === 1 ? "it" : "them"} would notify them.
            </p>
          )}
          {participants.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? "Hide participants" : "Show participants"}
            </Button>
          )}
          {expanded && (
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {participants.map((participant) => (
                <li key={participant.applicationId} className="tabular-nums">
                  {participant.participantName}{" "}
                  <span className="text-amber-700">({participant.email})</span>
                  {participant.submittedAt && (
                    <> — submitted {formatDate(participant.submittedAt)}</>
                  )}
                </li>
              ))}
              {count > participants.length && (
                <li className="text-amber-700">
                  …and {count - participants.length} more.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
