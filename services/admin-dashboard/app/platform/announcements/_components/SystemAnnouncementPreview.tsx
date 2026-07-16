"use client";

import { formatAnnouncementLabel } from "./system-announcement-utils";

type SystemAnnouncementPreviewProps = {
  title: string;
  summary: string;
  content: string;
  type: string;
  priority: string;
  imageUrl: string;
  author: string;
  tags: string[];
  actionLabel: string;
  actionUrl: string;
};

export function SystemAnnouncementPreview({
  title,
  summary,
  content,
  type,
  priority,
  imageUrl,
  author,
  tags,
  actionLabel,
  actionUrl,
}: SystemAnnouncementPreviewProps) {
  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Public Preview
          </p>
          <p className="text-[11px] text-zinc-400">
            This is how the announcement detail page will appear in the public site.
          </p>
        </div>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative h-48 w-full bg-slate-100">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Featured image preview
            </div>
          )}
        </div>
        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {formatAnnouncementLabel(type) || "General"}
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {formatAnnouncementLabel(priority) || "Normal"}
            </span>
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>

          <h2 className="text-2xl font-extrabold text-blue-950">
            {title.trim() || "Announcement title"}
          </h2>

          <p className="text-sm font-semibold text-blue-900">
            {(author.trim() || "YBB")} <span className="text-slate-500"> - </span> Preview
          </p>

          {(summary.trim() || !content.trim()) && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
              {summary.trim() || "A short summary will appear here when provided."}
            </p>
          )}

          {content.trim() ? (
            <div
              className="prose prose-slate max-w-none prose-headings:text-blue-950 prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <p className="text-sm leading-7 text-slate-500">
              Rich text content preview will appear here as you write.
            </p>
          )}

          {actionLabel.trim() && actionUrl.trim() && (
            <div>
              <span className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
                {actionLabel.trim()}
              </span>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
