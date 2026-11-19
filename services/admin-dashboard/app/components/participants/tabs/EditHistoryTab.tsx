// services/admin-dashboard/app/components/participants/tabs/EditHistoryTab.tsx
"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, History } from "lucide-react";
import { getApplicationEditHistory, type ApplicationEditHistoryEntry } from "@/src/shared/api-client";
import { EmptyState } from "@/src/admin/empty-state";
import { formatDateTime } from "@/lib/utils";
import { EMPTY_VALUE, changeLabel, formatChangeValue, isLongValue } from "@/lib/edit-history";
import { TabError, TabSkeleton } from "./TabLoadStates";

/** Query key for an application's edit history; invalidate it after a submission edit. */
export const editHistoryQueryKey = (applicationId: string) => ["application-edit-history", applicationId] as const;

interface EditHistoryTabProps {
  applicationId: string;
  /** From buildChangeLabels(application.submissionForm.sections, application.essays). */
  changeLabels: ReadonlyMap<string, string>;
}

/** Mounted only while the tab is open, so the first fetch happens on first open. */
export function EditHistoryTab({ applicationId, changeLabels }: EditHistoryTabProps) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: editHistoryQueryKey(applicationId),
    queryFn: () => getApplicationEditHistory(applicationId),
  });

  if (isPending) return <TabSkeleton label="Loading edit history" />;
  if (isError) return <TabError title="Couldn't load edit history" error={error} onRetry={() => void refetch()} />;
  if (data.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No admin edits yet"
        description="Changes made with Edit Submission show up here with who made them and why."
      />
    );
  }
  return <EditHistoryList entries={data} changeLabels={changeLabels} />;
}

export function EditHistoryList({
  entries,
  changeLabels,
}: {
  entries: ApplicationEditHistoryEntry[];
  changeLabels: ReadonlyMap<string, string>;
}) {
  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-zinc-200 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-semibold text-zinc-900">
              {entry.editor ? (
                <span title={entry.editor.email}>{entry.editor.name}</span>
              ) : (
                <span className="text-zinc-500">Unknown admin</span>
              )}
              {entry.editor && entry.editor.email !== entry.editor.name && (
                <span className="ml-2 text-xs font-normal text-zinc-400">{entry.editor.email}</span>
              )}
            </p>
            <time dateTime={entry.editedAt} className="text-xs text-zinc-500">
              {formatDateTime(entry.editedAt)}
            </time>
          </div>
          <p className="mt-1 text-sm text-zinc-700">
            {entry.reason?.trim() || <span className="italic text-zinc-400">No reason given</span>}
          </p>
          {entry.changes.length > 0 && (
            <dl className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100">
              {entry.changes.map((c) => (
                <div key={c.key} className="grid gap-1 py-2.5 md:grid-cols-[minmax(0,14rem)_1fr] md:gap-4">
                  <dt className="text-xs font-medium text-zinc-500" title={c.key}>
                    {changeLabel(c.key, changeLabels)}
                  </dt>
                  <dd className="flex min-w-0 flex-col gap-1 text-sm md:flex-row md:items-start md:gap-2">
                    <ChangeValue value={c.old} tone="old" />
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-zinc-300 md:mt-0.5 md:block" aria-label="changed to" />
                    <ChangeValue value={c.new} tone="new" />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ol>
  );
}

function ChangeValue({ value, tone }: { value: unknown; tone: "old" | "new" }) {
  const [expanded, setExpanded] = useState(false);
  const text = formatChangeValue(value);
  const isEmpty = text === EMPTY_VALUE;
  const isLong = !isEmpty && isLongValue(text);
  const toneClass = isEmpty ? "italic text-zinc-400" : tone === "old" ? "text-zinc-500" : "text-zinc-900";

  return (
    <div className="min-w-0 flex-1">
      <span className="sr-only">{tone === "old" ? "Before: " : "After: "}</span>
      <p className={`whitespace-pre-wrap break-words ${toneClass} ${isLong && !expanded ? "line-clamp-3" : ""}`}>{text}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-0.5 text-xs font-medium text-blue-600 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
