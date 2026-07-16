import * as React from "react";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/src/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: { value: number; label?: string };
  className?: string;
  iconClassName?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  iconClassName,
}: StatCardProps) {
  const TrendIcon =
    trend && trend.value > 0 ? TrendingUp : trend && trend.value < 0 ? TrendingDown : Minus;
  const trendColor =
    trend && trend.value > 0
      ? "text-emerald-600"
      : trend && trend.value < 0
        ? "text-red-500"
        : "text-zinc-400";

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
            <p className="mt-1.5 truncate text-2xl font-bold text-zinc-900">{value}</p>
            {(description || trend) && (
              <div className="mt-1.5 flex items-center gap-1.5">
                {trend && (
                  <span className={cn("flex items-center gap-0.5 text-xs font-medium", trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    {Math.abs(trend.value)}%
                  </span>
                )}
                {description && <span className="text-xs text-zinc-400">{description}</span>}
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50",
                iconClassName,
              )}
            >
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
