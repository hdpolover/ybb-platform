"use client";

import type { ProgramSupportTicketSummary } from "@/src/shared/api-client";
import { Badge } from "@/src/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, PRIORITY_CONFIG, timeAgo } from "./types";

interface TicketListItemProps {
  ticket: ProgramSupportTicketSummary;
  isSelected: boolean;
  isStale: boolean;
  onClick: () => void;
}

export function TicketListItem({ ticket, isSelected, isStale, onClick }: TicketListItemProps) {
  const statusCfg = STATUS_CONFIG[ticket.status];
  const priorityCfg = PRIORITY_CONFIG[ticket.priority];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border-l-4 border p-3 text-left transition-all",
        isSelected
          ? "border-blue-400 bg-blue-50 shadow-sm"
          : isStale
            ? "border-l-amber-400 border-zinc-200 bg-white hover:bg-zinc-50"
            : "border-l-transparent border-zinc-200 bg-white hover:bg-zinc-50",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {ticket.ticketNumber}
      </p>
      <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-zinc-900">{ticket.subject}</p>
      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
        {ticket.participant?.fullName ?? "Unknown participant"}{" "}
        <span className="text-zinc-400">({ticket.participant?.email ?? "no email"})</span>
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Badge variant={statusCfg.badgeVariant} className="text-[10px] py-0 px-1.5">
          {statusCfg.label}
        </Badge>
        <Badge variant={priorityCfg.badgeVariant} className="text-[10px] py-0 px-1.5">
          {priorityCfg.label}
        </Badge>
        <span className="ml-auto text-[10px] text-zinc-400">{timeAgo(ticket.lastMessageAt)}</span>
      </div>
    </button>
  );
}
