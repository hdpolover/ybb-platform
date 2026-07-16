"use client";

import * as React from "react";
import { Search, SlidersHorizontal, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/src/ui/input";
import { Button } from "@/src/ui/button";

interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  resultCount?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  resultCount,
  onRefresh,
  refreshing,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {onSearchChange !== undefined && (
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {filters && (
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
          {filters}
        </div>
      )}

      {resultCount !== undefined && (
        <span className="ml-auto shrink-0 text-xs text-zinc-400">
          {resultCount.toLocaleString()} result{resultCount !== 1 ? "s" : ""}
        </span>
      )}

      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={refreshing}
          className="shrink-0"
          title="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
      )}
    </div>
  );
}
