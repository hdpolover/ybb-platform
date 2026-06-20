"use client";

import type { ProgramSupportTicketMessage } from "@/src/shared/api-client";
import { cn } from "@/lib/utils";
import { sanitizeRichHtml } from "./types";

interface MessageBubbleProps {
  message: ProgramSupportTicketMessage;
  isMainThread?: boolean;
}

function AttachmentItem({ fileUrl, fileName, mimeType }: { fileUrl: string; fileName: string; mimeType?: string }) {
  const isImage = mimeType?.startsWith("image") ?? /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(fileUrl);

  if (isImage) {
    return (
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md border border-zinc-200"
        style={{ maxWidth: 200 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl}
          alt={fileName}
          className="h-auto w-full object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-blue-600 hover:bg-zinc-100"
    >
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
      </svg>
      {fileName}
    </a>
  );
}

export function MessageBubble({ message, isMainThread = false }: MessageBubbleProps) {
  const sanitized = sanitizeRichHtml(message.message);

  if (message.isInternalNote) {
    return (
      <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Internal note
          </span>
          <span className="text-[10px] text-amber-600">Not visible to participant</span>
          <span className="ml-auto text-[10px] text-amber-600">{message.senderName}</span>
        </div>
        <div
          className="prose prose-xs max-w-none text-amber-900"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
        {message.attachments.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <AttachmentItem
                key={att.fileId}
                fileUrl={att.fileUrl}
                fileName={att.fileName}
                mimeType={att.mimeType}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (message.isFromAdmin) {
    return (
      <div className={cn("flex justify-end", isMainThread && "px-1")}>
        <div className="max-w-[80%] space-y-1.5">
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px] text-zinc-400">{message.senderName}</span>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
              A
            </span>
          </div>
          <div className="rounded-2xl rounded-tr-sm bg-blue-500 px-3.5 py-2.5 text-xs text-white shadow-sm">
            <div
              className="prose prose-xs prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />
          </div>
          {message.attachments.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-2 mt-1">
              {message.attachments.map((att) => (
                <AttachmentItem
                  key={att.fileId}
                  fileUrl={att.fileUrl}
                  fileName={att.fileName}
                  mimeType={att.mimeType}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex justify-start", isMainThread && "px-1")}>
      <div className="max-w-[80%] space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">
            P
          </span>
          <span className="text-[10px] text-zinc-400">{message.senderName}</span>
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-zinc-100 px-3.5 py-2.5 text-xs text-zinc-800 shadow-sm">
          <div
            className="prose prose-xs max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
        </div>
        {message.attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.attachments.map((att) => (
              <AttachmentItem
                key={att.fileId}
                fileUrl={att.fileUrl}
                fileName={att.fileName}
                mimeType={att.mimeType}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
