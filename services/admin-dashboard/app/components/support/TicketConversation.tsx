"use client";

import { useEffect, useRef } from "react";
import type {
  ProgramSupportTicketAttachment,
  ProgramSupportTicketDetail,
} from "@/src/shared/api-client";
import { sanitizeRichHtml } from "./types";
import { MessageBubble } from "./MessageBubble";

interface TicketConversationProps {
  ticket: ProgramSupportTicketDetail;
  originalDescription: string;
  originalAttachments: ProgramSupportTicketAttachment[];
}

function OriginalDescriptionCard({
  description,
  attachments,
}: {
  description: string;
  attachments: ProgramSupportTicketAttachment[];
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          Original Description
        </span>
      </div>
      {description ? (
        <div
          className="prose prose-xs max-w-none text-amber-900"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(description) }}
        />
      ) : (
        <p className="text-xs italic text-amber-700">No description provided.</p>
      )}
      {attachments.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
            Attachments
          </p>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => {
              const isImage =
                att.mimeType?.startsWith("image") ??
                /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(att.fileUrl);
              if (isImage) {
                return (
                  <a
                    key={att.fileId}
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-md border border-amber-200"
                    style={{ maxWidth: 160 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="h-auto w-full object-cover"
                      loading="lazy"
                    />
                  </a>
                );
              }
              return (
                <a
                  key={att.fileId}
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-100 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-200"
                >
                  {att.fileName}
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TicketConversation({
  ticket,
  originalDescription,
  originalAttachments,
}: TicketConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket.messages]);

  const firstParticipantMessage = ticket.messages.find((m) => !m.isFromAdmin);

  const messagesToShow = ticket.messages.filter((message) => {
    if (message.id !== firstParticipantMessage?.id) return true;
    const msgContent = sanitizeRichHtml(message.message).trim();
    const descContent = originalDescription.trim();
    return msgContent !== descContent && msgContent.length > 0;
  });

  return (
    <div className="space-y-4">
      <OriginalDescriptionCard
        description={originalDescription}
        attachments={originalAttachments}
      />

      {messagesToShow.length > 0 ? (
        <div className="space-y-3">
          {messagesToShow.map((message) => (
            <MessageBubble key={message.id} message={message} isMainThread />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-zinc-200 px-3 py-5 text-center text-xs text-zinc-400">
          No replies yet.
        </p>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
