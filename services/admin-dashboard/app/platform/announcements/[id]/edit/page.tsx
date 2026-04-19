"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  getSystemAnnouncementAdmin,
  updateSystemAnnouncement,
  type SystemAnnouncement,
} from "@/src/shared/api-client";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";

type Status = "draft" | "published";

export default function EditAnnouncementPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [type, setType] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [targetAudience, setTargetAudience] = useState("all");
  const [imageUrl, setImageUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showBanner, setShowBanner] = useState(false);
  const [isDismissible, setIsDismissible] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [originalData, setOriginalData] = useState<SystemAnnouncement | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSystemAnnouncementAdmin(id)
      .then((data) => {
        setOriginalData(data);
        setTitle(data.title);
        setContent(data.content);
        setSummary(data.summary ?? "");
        setType(data.type);
        setPriority(data.priority);
        setTargetAudience(data.targetAudience);
        setImageUrl((data.metadata?.imageUrl as string) ?? "");
        setAuthor((data.metadata?.author as string) ?? "");
        setActionLabel(data.actionLabel ?? "");
        setActionUrl(data.actionUrl ?? "");
        setStartDate(data.startDate ? data.startDate.slice(0, 10) : "");
        setEndDate(data.endDate ? data.endDate.slice(0, 10) : "");
        setShowBanner(data.showBanner);
        setIsDismissible(data.isDismissible);
        setIsPublished(data.isPublished);
        setLoaded(true);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load");
        setLoaded(true);
      });
  }, [id]);

  const handleContentChange = useCallback((html: string) => {
    setContent(html);
  }, []);

  async function save(targetPublished: boolean) {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setSaving(true);
    try {
      await updateSystemAnnouncement(id, {
        title: title.trim(),
        content,
        summary: summary.trim() || undefined,
        type,
        priority,
        targetAudience,
        isPublished: targetPublished,
        showBanner,
        isDismissible,
        actionUrl: actionUrl.trim() || undefined,
        actionLabel: actionLabel.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        metadata: {
          ...(originalData?.metadata ?? {}),
          imageUrl: imageUrl.trim() || undefined,
          author: author.trim() || undefined,
        },
      });
      setIsPublished(targetPublished);
      toast.success(targetPublished ? "Published!" : "Saved as draft.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const status: Status = isPublished ? "published" : "draft";
  const statusColors: Record<Status, string> = {
    draft: "bg-zinc-100 text-zinc-600",
    published: "bg-emerald-50 text-emerald-700",
  };

  if (!loaded) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-6 flex flex-col sm:-mx-6 lg:-mx-8">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3 shadow-sm">
        <Link
          href="/platform/announcements"
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back
        </Link>

        <h1 className="max-w-xs truncate text-sm font-semibold text-zinc-900">{title || "Edit Announcement"}</h1>

        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColors[status]}`}
        >
          {status}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(false)}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            {saving && !isPublished ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(true)}
            className={[
              "rounded-md px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60",
              isPublished
                ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "bg-blue-500 text-white hover:bg-blue-600",
            ].join(" ")}
          >
            {saving ? "Saving…" : isPublished ? "Update Published" : "Publish Now"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-[calc(100vh-64px-53px)] flex-col lg:flex-row">
        {/* Editor area */}
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title…"
            className="mb-6 block w-full border-0 border-b border-zinc-200 bg-transparent pb-3 text-2xl font-bold text-zinc-900 placeholder:text-zinc-300 outline-none focus:border-blue-400"
          />

          {loaded && (
            <RichTextEditor
              key={id}
              content={content}
              placeholder="Write your announcement here…"
              onChange={handleContentChange}
            />
          )}
        </main>

        {/* Sidebar */}
        <aside className="w-full shrink-0 overflow-y-auto border-t border-zinc-200 bg-white px-5 py-5 lg:w-72 lg:border-l lg:border-t-0">
          {/* Classification */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Classification</h2>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                <option value="general">General</option>
                <option value="maintenance">Maintenance</option>
                <option value="deadline">Deadline</option>
                <option value="feature">Feature</option>
                <option value="alert">Alert</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Target Audience</label>
              <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className={inputCls}>
                <option value="all">All</option>
                <option value="participants">Participants</option>
                <option value="ambassadors">Ambassadors</option>
                <option value="specific_program">Specific Program</option>
              </select>
            </div>
          </section>

          <div className="my-4 border-t border-zinc-100" />

          {/* Media & Author */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Media & Author</h2>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Featured Image URL</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
              {imageUrl && (
                <img src={imageUrl} alt="" className="mt-2 w-full rounded-md border border-zinc-200 object-cover" style={{ maxHeight: 120 }} />
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Author</label>
              <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="YBB Team" className={inputCls} />
            </div>
          </section>

          <div className="my-4 border-t border-zinc-100" />

          {/* Excerpt */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Excerpt</h2>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Summary <span className="text-zinc-400">(shown in listing)</span>
              </label>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={inputCls} placeholder="Short summary…" />
            </div>
          </section>

          <div className="my-4 border-t border-zinc-100" />

          {/* CTA */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Call to Action</h2>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Button Label</label>
              <input type="text" value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} placeholder="Read More" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Button URL</label>
              <input type="url" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} placeholder="https://..." className={inputCls} />
            </div>
          </section>

          <div className="my-4 border-t border-zinc-100" />

          {/* Scheduling */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Display Window</h2>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </section>

          <div className="my-4 border-t border-zinc-100" />

          {/* Options */}
          <section className="space-y-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Options</h2>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={showBanner} onChange={(e) => setShowBanner(e.target.checked)} className="h-3.5 w-3.5 rounded border-zinc-300" />
              <span className="text-[11px] font-medium text-zinc-700">Show as banner</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={isDismissible} onChange={(e) => setIsDismissible(e.target.checked)} className="h-3.5 w-3.5 rounded border-zinc-300" />
              <span className="text-[11px] font-medium text-zinc-700">Dismissible</span>
            </label>
          </section>

          {originalData && (
            <>
              <div className="my-4 border-t border-zinc-100" />
              <section className="space-y-1 text-[10px] text-zinc-400">
                <p>Created: {new Date(originalData.createdAt).toLocaleString()}</p>
                {originalData.publishedAt && (
                  <p>Published: {new Date(originalData.publishedAt).toLocaleString()}</p>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
