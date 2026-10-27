// app/components/documents/LoaDeliveryBadge.tsx
import { Badge } from "@/src/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { LoaDeliveryFields } from "@/src/shared/api-client";

const VARIANT = {
  delivered: "success",
  bounced: "destructive",
  complained: "destructive",
  delayed: "warning",
} as const;

const LABEL = {
  delivered: "Delivered",
  bounced: "Bounced",
  complained: "Complained",
  delayed: "Delayed",
} as const;

function verdictTime(row: LoaDeliveryFields): string | null {
  switch (row.deliveryStatus) {
    case "delivered":
      return row.deliveredAt;
    case "bounced":
      return row.bouncedAt;
    case "complained":
      return row.complainedAt;
    default:
      return row.deliveryUpdatedAt;
  }
}

/**
 * What happened after Resend accepted the email (webhook-fed), plus whether the
 * participant has downloaded the letter. Null status = no webhook yet, which is
 * different from "not delivered" and is shown as such.
 */
export function LoaDeliveryBadge({ row }: { row: LoaDeliveryFields }) {
  const time = verdictTime(row);
  return (
    <div className="flex flex-col items-start gap-1">
      {row.deliveryStatus ? (
        <>
          <Badge variant={VARIANT[row.deliveryStatus]}>
            {LABEL[row.deliveryStatus]}
            {row.deliveryStatus === "bounced" && row.bounceType ? ` (${row.bounceType})` : ""}
          </Badge>
          {time && <span className="text-xs text-zinc-500">{formatDateTime(time)}</span>}
        </>
      ) : (
        <span className="text-xs text-zinc-400">No report yet</span>
      )}
      {row.downloadCount > 0 && (
        <Badge variant="info">
          Downloaded
          {row.firstDownloadedAt ? ` ${formatDateTime(row.firstDownloadedAt)}` : ""}
        </Badge>
      )}
    </div>
  );
}
