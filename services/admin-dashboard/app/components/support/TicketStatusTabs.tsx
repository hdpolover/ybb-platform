"use client";

import type { ProgramSupportTicketStatus } from "@/src/shared/api-client";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, STATUS_OPTIONS } from "./types";

interface TicketStatusTabsProps {
  counts: Record<string, number>;
  activeStatus: ProgramSupportTicketStatus | "";
  onStatusChange: (status: ProgramSupportTicketStatus | "") => void;
}

const ALL_TAB = { value: "" as const, label: "All" };

export function TicketStatusTabs({ counts, activeStatus, onStatusChange }: TicketStatusTabsProps) {
  const tabs = [
    ALL_TAB,
    ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_CONFIG[s].label })),
  ];

  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-1">
      {tabs.map((tab) => {
        const count = counts[tab.value === "" ? "all" : tab.value] ?? 0;
        const isActive = activeStatus === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onStatusChange(tab.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              isActive
                ? "bg-white shadow-sm border border-blue-100 text-blue-700"
                : "text-zinc-500 hover:text-zinc-700 hover:bg-white/50",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                isActive ? "bg-blue-100 text-blue-700" : "bg-zinc-200 text-zinc-600",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
