// services/admin-dashboard/app/components/scoring/ScoreStatusBadge.tsx
"use client";

/**
 * Score-status badge for the real `ScoreStatus` enum (pending / scored /
 * go_to_interview / rejected / finalist / not_selected). Shared by the
 * fully-funded participants table and the review queue header so both
 * surfaces agree on the same labels/colors instead of drifting.
 *
 * NOTE: InterviewParticipantsTable.tsx has its own local `ScoreStatusBadge`,
 * but it's keyed on "High"/"Medium"/"Low" — unrelated display values, not
 * this enum — so it isn't reusable here.
 */
export function ScoreStatusBadge({ status }: { status: string | null }) {
  const labels: Record<string, string> = {
    pending: "Pending",
    scored: "Scored",
    go_to_interview: "Go to Interview",
    rejected: "Rejected",
    finalist: "Finalist",
    not_selected: "Not Selected",
  };
  const label = status ? labels[status] ?? status : "Not Scored";
  let className = "bg-zinc-100 text-zinc-500";

  if (status === "scored") className = "bg-emerald-100 text-emerald-700";
  else if (status === "go_to_interview") className = "bg-blue-100 text-blue-700";
  else if (status === "rejected") className = "bg-rose-100 text-rose-700";
  else if (status === "pending") className = "bg-amber-100 text-amber-700";
  else if (status === "finalist") className = "bg-emerald-100 text-emerald-700";
  else if (status === "not_selected") className = "bg-zinc-200 text-zinc-600";

  return (
    <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}
