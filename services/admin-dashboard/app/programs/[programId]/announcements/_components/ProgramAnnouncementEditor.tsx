"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowUpTrayIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";
import {
  createProgramAnnouncement,
  getProgramAnnouncement,
  updateProgramAnnouncement,
  uploadProgramAnnouncementAsset,
  type ProgramAnnouncement,
} from "@/src/shared/api-client";
import { formatDateTime } from "@/lib/utils";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  dateTimeLocalToIsoString,
  getProgramAnnouncementStatus,
  getProgramAnnouncementStatusClasses,
  getProgramAnnouncementStatusLabel,
  normalizeOptionalString,
  parseTagInput,
  richTextToPlainText,
  toDateTimeLocalValue,
} from "./program-announcement-utils";

type EditorMode = "create" | "edit";

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "update", label: "Update" },
  { value: "reminder", label: "Reminder" },
  { value: "deadline", label: "Deadline" },
  { value: "alert", label: "Alert" },
  { value: "award", label: "Award" },
  { value: "scholarship", label: "Scholarship" },
];

const TARGET_AUDIENCE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "applicants", label: "Applicants" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "participants", label: "Participants" },
];

export function ProgramAnnouncementEditor({ mode }: { mode: EditorMode }) {
  const router = useRouter();
  const params = useParams<{ programId: string; id?: string }>();
  const { accessiblePrograms, adminProfile } = useAuth();
  const resolvedProgramId = useResolvedProgramId(params.programId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loaded, setLoaded] = useState(mode === "create");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [targetAudience, setTargetAudience] = useState("all");
  const [tagsInput, setTagsInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [publishDate, setPublishDate] = useState(() => toDateTimeLocalValue(new Date()));
  const [sendEmail, setSendEmail] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState<ProgramAnnouncement | null>(null);

  const program = useMemo(
    () =>
      accessiblePrograms.find(
        (item) => item.programId === params.programId || item.programSlug === params.programId,
      ),
    [accessiblePrograms, params.programId],
  );

  const inputCls =
    "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const announcementStatus = useMemo(
    () => getProgramAnnouncementStatus({ isActive, publishDate }),
    [isActive, publishDate],
  );

  useEffect(() => {
    if (mode !== "edit" || !params.id) {
      return;
    }

    setLoaded(false);
    setLoadError(null);

    getProgramAnnouncement(params.id)
      .then((data) => {
        if (data.programId !== resolvedProgramId) {
          throw new Error("This announcement does not belong to the selected program.");
        }

        setAnnouncement(data);
        setTitle(data.title);
        setContent(data.content);
        setCategory(data.category ?? "general");
        setTargetAudience(data.targetAudience);
        setTagsInput((data.tags ?? []).join(", "));
        setImageUrl(data.imageUrl ?? "");
        setPublishDate(toDateTimeLocalValue(data.publishDate));
        setSendEmail(data.sendEmail);
        setIsPinned(data.isPinned);
        setIsActive(data.isActive);
        setLoaded(true);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Failed to load announcement.");
        setLoaded(true);
      });
  }, [mode, params.id, resolvedProgramId]);

  const uploadAsset = useCallback(
    async (file: File, kind: "image" | "attachment") => {
      const userId = adminProfile?.userId;
      const brandId = program?.brandId;

      if (!resolvedProgramId || !userId || !brandId) {
        throw new Error("Missing program upload context. Refresh the page and try again.");
      }

      const upload = await uploadProgramAnnouncementAsset({
        programId: resolvedProgramId,
        userId,
        brandId,
        file,
        kind,
        title: title.trim() || file.name,
        altText: kind === "image" ? title.trim() || undefined : undefined,
      });

      if (!upload.publicUrl) {
        throw new Error("Upload succeeded but no public URL was returned.");
      }

      return upload.publicUrl;
    },
    [adminProfile?.userId, resolvedProgramId, program?.brandId, title],
  );

  const handleFeaturedImageUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;

      setImageUploading(true);
      try {
        const url = await uploadAsset(file, "image");
        setImageUrl(url);
        toast.success("Featured image uploaded.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to upload featured image.");
      } finally {
        setImageUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [uploadAsset],
  );

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }

    if (!richTextToPlainText(content)) {
      toast.error("Content is required.");
      return;
    }

    setSaving(true);

    try {
      const normalizedImageUrl = normalizeOptionalString(imageUrl);
      const payload = {
        title: title.trim(),
        content,
        category: normalizeOptionalString(category),
        targetAudience,
        tags: parseTagInput(tagsInput),
        sendEmail,
        isPinned,
        imageUrl: mode === "edit" ? normalizedImageUrl ?? null : normalizedImageUrl,
        publishDate: dateTimeLocalToIsoString(publishDate) ?? new Date().toISOString(),
        isActive,
      };

      const saved =
        mode === "edit" && params.id
          ? await updateProgramAnnouncement(params.id, payload)
          : await createProgramAnnouncement(resolvedProgramId, payload);

      toast.success(mode === "edit" ? "Announcement updated." : "Announcement created.");
      router.push(`/programs/${params.programId}/announcements/${saved.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save announcement.");
    } finally {
      setSaving(false);
    }
  }, [
    category,
    content,
    imageUrl,
    publishDate,
    isActive,
    isPinned,
    mode,
    params.id,
    resolvedProgramId,
    router,
    sendEmail,
    tagsInput,
    targetAudience,
    title,
  ]);

  if (!loaded) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
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
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3 shadow-sm">
        <Link
          href={`/programs/${params.programId}/announcements`}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back
        </Link>

        <div>
          <h1 className="text-sm font-semibold text-zinc-900">
            {mode === "edit" ? "Edit Announcement" : "New Announcement"}
          </h1>
          <p className="text-[11px] text-zinc-500">
            {program?.programName ?? "Selected Program"}
          </p>
        </div>

        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getProgramAnnouncementStatusClasses(announcementStatus)}`}
        >
          {getProgramAnnouncementStatusLabel(announcementStatus)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Create Announcement"}
          </button>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-64px-53px)] flex-col lg:flex-row">
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Announcement title…"
            className="mb-6 block w-full border-0 border-b border-zinc-200 bg-transparent pb-3 text-2xl font-bold text-zinc-900 placeholder:text-zinc-300 outline-none focus:border-blue-400"
          />

          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-[11px] text-blue-700">
            Use the editor toolbar to upload one-off images and attachments directly into the
            announcement body. Those files stay attached to this announcement flow and do not need
            to be added to the media library first.
          </div>

          <RichTextEditor
            content={content}
            placeholder="Write the announcement details here…"
            onChange={setContent}
            onUploadImage={(file) => uploadAsset(file, "image")}
            onUploadFile={async (file) => ({
              url: await uploadAsset(file, "attachment"),
              name: file.name,
            })}
          />
        </main>

        <aside className="w-full shrink-0 overflow-y-auto border-t border-zinc-200 bg-white px-5 py-5 lg:w-80 lg:border-l lg:border-t-0">
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Classification
            </h2>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={inputCls}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Target Audience
              </label>
              <select
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
                className={inputCls}
              >
                {TARGET_AUDIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Tags <span className="text-zinc-400">(comma separated)</span>
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="registration, logistics, deadline"
                className={inputCls}
              />
            </div>
          </section>

          <div className="my-4 border-t border-zinc-100" />

          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Publication
            </h2>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Status</label>
              <select
                value={isActive ? "published" : "draft"}
                onChange={(event) => setIsActive(event.target.value === "published")}
                className={inputCls}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Publish At
              </label>
              <input
                type="datetime-local"
                value={publishDate}
                onChange={(event) => setPublishDate(event.target.value)}
                className={inputCls}
              />
            </div>
            <p className="text-[10px] leading-5 text-zinc-500">
              {!isActive
                ? "Draft announcements stay hidden until you publish them."
                : announcementStatus === "scheduled"
                  ? "This announcement is scheduled and will appear on the public site at the selected time."
                  : "Published announcements appear on the public site and participant dashboard feeds immediately."}
            </p>
          </section>

          <div className="my-4 border-t border-zinc-100" />

          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Featured Image
            </h2>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Image URL</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleFeaturedImageUpload(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={imageUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              <ArrowUpTrayIcon className="h-3.5 w-3.5" />
              {imageUploading ? "Uploading…" : "Upload Featured Image"}
            </button>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-zinc-400">
                  <PhotoIcon className="h-8 w-8" />
                  <p className="text-[11px]">No featured image selected</p>
                </div>
              )}
            </div>
          </section>

          <div className="my-4 border-t border-zinc-100" />

          <section className="space-y-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Options
            </h2>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(event) => setIsPinned(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-300"
              />
              <span className="text-[11px] font-medium text-zinc-700">Pin to top</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-300"
              />
              <span className="text-[11px] font-medium text-zinc-700">Send email notification</span>
            </label>
          </section>

          {announcement && (
            <>
              <div className="my-4 border-t border-zinc-100" />
              <section className="space-y-1 text-[10px] text-zinc-400">
                <p>Publish at: {formatDateTime(announcement.publishDate)}</p>
                <p>Created: {formatDateTime(announcement.createdAt)}</p>
                <p>Updated: {formatDateTime(announcement.updatedAt)}</p>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
