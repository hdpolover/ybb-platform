"use client";

import { useRef, useState } from "react";

interface ReplyComposerProps {
  onSend: (message: string, isInternalNote: boolean, attachments: File[]) => Promise<void>;
  isSending: boolean;
  isUploading: boolean;
}

export function ReplyComposer({ onSend, isSending, isUploading }: ReplyComposerProps) {
  const [replyMessage, setReplyMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isSending || isUploading;
  const isEmpty = replyMessage.trim().length === 0;

  const handleSend = async () => {
    if (isEmpty || isBusy) return;
    const message = replyMessage.trim();
    const files = attachments.slice();
    const noteFlag = isInternalNote;
    setReplyMessage("");
    setAttachments([]);
    setIsInternalNote(false);
    await onSend(message, noteFlag, files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="space-y-2">
      {/* Internal note toggle */}
      <div className="flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 select-none">
          <input
            type="checkbox"
            checked={isInternalNote}
            onChange={(e) => setIsInternalNote(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-300 accent-amber-500"
          />
          <span className="text-xs font-medium text-zinc-600">Internal note</span>
        </label>
        {isInternalNote ? (
          <span className="text-[10px] text-amber-600">(not sent to participant)</span>
        ) : null}
      </div>

      {/* Textarea */}
      <div
        className={
          isInternalNote
            ? "rounded-xl border border-amber-200 bg-amber-50"
            : "rounded-xl border border-zinc-200 bg-white"
        }
      >
        <textarea
          rows={4}
          value={replyMessage}
          onChange={(e) => setReplyMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isInternalNote
              ? "Add an internal note (only visible to admins)..."
              : "Type your reply... (Ctrl+Enter to send)"
          }
          disabled={isBusy}
          className="w-full resize-none rounded-xl bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-zinc-400 disabled:opacity-60"
        />

        {/* Attachment chips */}
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 px-3 py-2">
            {attachments.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600"
              >
                {file.name}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                  aria-label={`Remove ${file.name}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              Attach file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            {isBusy ? (
              <span className="text-[10px] text-zinc-400">
                {isUploading ? "Uploading..." : "Sending..."}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isEmpty || isBusy}
            className="rounded-md bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-40"
          >
            {isSending ? "Sending..." : "Send Reply"}
          </button>
        </div>
      </div>
    </div>
  );
}
