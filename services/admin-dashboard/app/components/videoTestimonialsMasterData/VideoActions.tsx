"use client";

import { useState, useEffect, useRef } from "react";
import {
  PencilSquareIcon,
  PlayCircleIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import {
  createProgramTestimonial,
  updateProgramTestimonial,
  deleteProgramTestimonial,
  uploadFileViaPresignedUrl,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import type { VideoTestimonyRow } from "./VideoTestimonialsTable";
import { parseVideoUrl, VIDEO_PLATFORM_LABEL } from "./video-platform";

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

// ─── Search (controlled, no URL state) ────────────────────────────────────────
export function VideoSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search by title, URL, description..."
      className={INPUT_CLS}
    />
  );
}

// ─── Add / Edit Form Drawer ────────────────────────────────────────────────────
function VideoFormDrawer({
  isOpen,
  onClose,
  programId,
  brandId,
  initialData,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  programId?: string;
  brandId?: string;
  initialData?: VideoTestimonyRow;
  onSuccess: () => void;
}) {
  const isEditMode = !!initialData;

  const [title, setTitle] = useState("");
  const { adminProfile } = useAuth();
  const [videoUrl, setVideoUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseVideoUrl(videoUrl);
  // A stored cover belongs to the stored link: changing the link drops it.
  const keptCover =
    !removeCover && initialData?.thumbnailUrl && videoUrl.trim() === initialData.videoUrl.trim()
      ? initialData.thumbnailUrl
      : null;
  const shownThumb = coverPreview ?? keptCover ?? parsed?.thumbnailUrl ?? null;

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.name ?? "");
      setVideoUrl(initialData?.videoUrl ?? "");
      setCoverFile(null);
      setRemoveCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
      setDescription(initialData?.description ?? "");
      setIsActive(initialData?.isActive ?? true);
      setSaving(false);
      setError(null);
    }
  }, [isOpen, initialData]);

  async function handleSave() {
    if (!videoUrl.trim() || !title.trim() || !description.trim()) {
      setError("All fields are required.");
      return;
    }
    if (!parsed) {
      setError("Paste the full link of a YouTube, Instagram, TikTok or Facebook video.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let thumbnailUrl: string | null | undefined =
        initialData?.thumbnailUrl && !keptCover ? null : undefined;
      if (coverFile) {
        const userId = adminProfile?.userId;
        if (!userId || !brandId) throw new Error("Cannot upload cover: missing user or brand context.");
        // Same bucket as testimonial photos (program-testimonies page): public CDN URL.
        const upload = await uploadFileViaPresignedUrl(coverFile, {
          userId,
          brandId,
          bucket: "avatars",
          assetType: "avatar",
        });
        if (!upload.publicUrl) throw new Error("Upload succeeded but no public URL returned.");
        thumbnailUrl = upload.publicUrl;
      }
      if (isEditMode && initialData) {
        await updateProgramTestimonial(initialData.id, {
          name: title.trim(),
          testimonial: description.trim(),
          videoUrl: videoUrl.trim(),
          ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
          type: "video",
          isActive,
        });
      } else {
        if (!programId) throw new Error("Program ID is missing.");
        await createProgramTestimonial(programId, {
          name: title.trim(),
          testimonial: description.trim(),
          videoUrl: videoUrl.trim(),
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
          type: "video",
          category: "alumni",
          brandId,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DrawerShell
      open={isOpen}
      onClose={onClose}
      title={isEditMode ? "Edit Video Testimonial" : "Add Video Testimonial"}
      description={
        isEditMode
          ? "Update the video link, cover, title, description, and status."
          : "Add a YouTube, Instagram, TikTok or Facebook video link."
      }
      error={error}
      locked={saving}
      width="sm:max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEditMode ? "Save Changes" : "Add Video"}
          </button>
        </>
      }
    >
      {/* Video URL + live thumbnail preview */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">
          Video URL <span className="text-rose-500">*</span>
          <span className="ml-1 font-normal text-zinc-400">(YouTube, Instagram, TikTok or Facebook)</span>
        </label>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          className={INPUT_CLS}
          placeholder="https://www.instagram.com/reel/... or youtube.com/shorts/..."
        />
        {videoUrl && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-14 w-20 flex-shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
              {shownThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownThumb} alt="Thumbnail preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                  {parsed ? "No cover" : "Invalid"}
                </div>
              )}
            </div>
            {parsed ? (
              <span className="text-xs text-emerald-600">Valid {VIDEO_PLATFORM_LABEL[parsed.platform]} link</span>
            ) : (
              <span className="text-xs text-rose-500">
                Not a supported video link. Open the video and copy its full link (short links like vm.tiktok.com or fb.watch don&apos;t embed).
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cover image: needed for platforms without a public thumbnail */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">
          Cover image
          <span className="ml-1 font-normal text-zinc-400">
            {parsed?.platform === "youtube" ? "(optional, YouTube thumbnail used otherwise)" : "(optional)"}
          </span>
        </label>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            setCoverFile(e.target.files?.[0] ?? null);
            setRemoveCover(false);
          }}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border file:border-zinc-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-700 hover:file:bg-zinc-50"
        />
        {(coverFile || keptCover) && (
          <button
            type="button"
            onClick={() => {
              setCoverFile(null);
              setRemoveCover(true);
              if (coverInputRef.current) coverInputRef.current.value = "";
            }}
            className="mt-1 text-xs font-medium text-rose-600 hover:text-rose-700"
          >
            Remove cover
          </button>
        )}
        {parsed && parsed.platform !== "youtube" && !shownThumb && (
          <p className="mt-1 text-xs text-zinc-400">
            Without a cover, the landing page card shows a play button instead of a photo.
          </p>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">
          Title <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={INPUT_CLS}
          placeholder="e.g. Delegate Highlights 2024"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">
          Description <span className="text-rose-500">*</span>
        </label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={INPUT_CLS}
          placeholder="Short description of what is covered in this video."
        />
      </div>

      {/* Status — only on edit */}
      {isEditMode && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status</label>
          <select
            value={isActive ? "active" : "inactive"}
            onChange={(e) => setIsActive(e.target.value === "active")}
            className={INPUT_CLS}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      )}
    </DrawerShell>
  );
}

// ─── View Drawer ───────────────────────────────────────────────────────────────
function VideoViewDrawer({
  isOpen,
  onClose,
  row,
}: {
  isOpen: boolean;
  onClose: () => void;
  row: VideoTestimonyRow;
}) {
  const parsed = parseVideoUrl(row.videoUrl);
  const embedUrl = parsed?.embedUrl ?? null;

  return (
    <DrawerShell
      open={isOpen}
      onClose={onClose}
      title={row.name}
      description="Preview the embedded video."
      width="sm:max-w-2xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100"
        >
          Close
        </button>
      }
    >
      <div
        className={`overflow-hidden rounded-xl border border-zinc-200 bg-black/90 shadow-inner ${
          !parsed || parsed.platform === "youtube" ? "aspect-video w-full" : "mx-auto aspect-[9/16] h-[70vh] max-w-full"
        }`}
      >
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={row.name}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-medium text-zinc-300">
            Unsupported video link.
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-500">
            {parsed ? `${VIDEO_PLATFORM_LABEL[parsed.platform]} URL` : "Video URL"}
          </div>
          <a
            href={row.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm font-medium text-blue-600 underline underline-offset-2"
          >
            {row.videoUrl}
          </a>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-500">Status</div>
          <span
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
              row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {row.isActive ? (
              <CheckCircleIcon className="h-4 w-4" />
            ) : (
              <XCircleIcon className="h-4 w-4" />
            )}
            {row.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-500">Description</div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {row.description}
          </div>
        </div>
      </div>
    </DrawerShell>
  );
}

// ─── Exported Action Buttons ───────────────────────────────────────────────────
export function AddVideoAction({
  programId,
  brandId,
  onSuccess,
}: {
  programId: string;
  brandId: string;
  onSuccess: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
      >
        <PlusIcon className="h-4 w-4" />
        <span>Add Video</span>
      </button>
      <VideoFormDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        programId={programId}
        brandId={brandId}
        onSuccess={onSuccess}
      />
    </>
  );
}

export function ViewVideoAction({ row }: { row: VideoTestimonyRow }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-600 transition hover:bg-sky-100 hover:text-sky-700"
        title="Play Video"
      >
        <PlayCircleIcon className="h-4 w-4" />
      </button>
      <VideoViewDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} row={row} />
    </>
  );
}

export function EditVideoAction({
  row,
  onSuccess,
}: {
  row: VideoTestimonyRow;
  onSuccess: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
        title="Edit Video"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <VideoFormDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialData={row}
        onSuccess={onSuccess}
      />
    </>
  );
}

export function DeleteVideoAction({
  id,
  onSuccess,
}: {
  id: string;
  onSuccess: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this video testimonial? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteProgramTestimonial(id);
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
      title="Delete Video"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
