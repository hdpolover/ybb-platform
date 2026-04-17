import * as React from "react";
import { LucideIcon, InboxIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
        <Icon className="h-7 w-7 text-zinc-400" />
      </div>
      <p className="text-sm font-semibold text-zinc-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-zinc-400">{description}</p>}
      {action && (
        <Button size="sm" onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
