import type {
  ProgramSupportTicketAttachment,
  ProgramSupportTicketStatus,
  ProgramSupportTicketPriority,
} from "@/src/shared/api-client";

export const STATUS_OPTIONS: ProgramSupportTicketStatus[] = [
  "open",
  "in_progress",
  "waiting_response",
  "resolved",
  "closed",
];

export const PRIORITY_OPTIONS: ProgramSupportTicketPriority[] = ["low", "normal", "high", "urgent"];

export const STATUS_LABELS: Record<ProgramSupportTicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_response: "Waiting Response",
  resolved: "Resolved",
  closed: "Closed",
};

export const STATUS_CONFIG: Record<
  ProgramSupportTicketStatus,
  { label: string; badgeVariant: "info" | "pending" | "warning" | "success" | "secondary" }
> = {
  open: { label: "Open", badgeVariant: "info" },
  in_progress: { label: "In Progress", badgeVariant: "pending" },
  waiting_response: { label: "Waiting", badgeVariant: "warning" },
  resolved: { label: "Resolved", badgeVariant: "success" },
  closed: { label: "Closed", badgeVariant: "secondary" },
};

export const PRIORITY_CONFIG: Record<
  ProgramSupportTicketPriority,
  { label: string; badgeVariant: "secondary" | "info" | "warning" | "destructive" }
> = {
  low: { label: "Low", badgeVariant: "secondary" },
  normal: { label: "Normal", badgeVariant: "info" },
  high: { label: "High", badgeVariant: "warning" },
  urgent: { label: "Urgent", badgeVariant: "destructive" },
};

export function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function sanitizeRichHtml(value: string): string {
  if (!value.trim()) return "";
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/<(?!\/?(p|br|strong|b|em|i|u|ul|ol|li|blockquote|code|pre)\b)[^>]*>/gi, "");
}

export function stripUploadedScreenshotsSection(value: string): string {
  return value
    .replace(
      /<p>\s*<strong>\s*Uploaded screenshots\s*<\/strong>\s*<\/p>\s*<ul>[\s\S]*?<\/ul>/i,
      "",
    )
    .trim();
}

export function guessMimeTypeFromUrl(url: string): string | undefined {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(url) ? "image/*" : undefined;
}

export function extractScreenshotAttachments(value: string): ProgramSupportTicketAttachment[] {
  if (!value.trim()) return [];
  const normalized = value.replace(/&amp;/gi, "&");
  const matches = normalized.match(/https?:\/\/[^\s<>"')]+/gi) ?? [];
  const urls = Array.from(new Set(matches.map((url) => url.replace(/[),.;]+$/, ""))));

  return urls.map((fileUrl, index) => {
    let fileName = `Screenshot ${index + 1}`;
    try {
      const pathName = decodeURIComponent(new URL(fileUrl).pathname);
      const lastSegment = pathName.split("/").filter(Boolean).pop();
      if (lastSegment) fileName = lastSegment;
    } catch {
      // Keep default for malformed URL.
    }

    return {
      fileId: `external-${index}`,
      fileName,
      fileUrl,
      mimeType: guessMimeTypeFromUrl(fileUrl),
    };
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
