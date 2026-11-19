// services/admin-dashboard/app/platform/audit/_components/ActionBadge.tsx
import { Badge, type BadgeProps } from "@/src/ui/badge";

const VARIANTS: Record<string, BadgeProps["variant"]> = {
  create: "success",
  update: "info",
  delete: "destructive",
  status_change: "warning",
  bulk_update: "purple",
};

export function ActionBadge({ action }: { action: string }) {
  return <Badge variant={VARIANTS[action] ?? "secondary"}>{action.replace(/_/g, " ")}</Badge>;
}
