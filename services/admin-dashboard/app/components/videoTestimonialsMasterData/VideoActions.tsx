"use client";

import { useState, useEffect } from "react";
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
} from "@/src/shared/api-client";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import type { VideoTestimonyRow } from "./VideoTestimonialsTable";

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

// ─── YouTube helpers ───────────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return v;
      const shortsMatch = parsed.pathname.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];
      const embedMatch = parsed.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id || null;
    }
  } catch {}
  return null;
}

function toEmbedUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

// ─── Add / Edit Form Drawer ────────────────────────────────────────────────────
function VideoFormDrawer({
  isOpen,
  onClose,
  programId,
  initialData,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  programId?: string;
  initialData?: VideoTestimonyRow;
  onSuccess: () => void;
}) {
  const isEditMode = !!initialData;

  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ytId = extractYouTubeId(youtubeUrl);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.name ?? "");
      setYoutubeUrl(initialData?.youtubeUrl ?? "");
      setDescription(initialData?.description ?? "");
      setIsActive(initialData?.isActive ?? true);
      setSaving(false);
      setError(null);
    }
  }, [isOpen, initialData]);

  async function handleSave() {
    if (!youtubeUrl.trim() || !title.trim() || !description.trim()) {
      setError("All fields are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEditMode && initialData) {
        await updateProgramTestimonial(initialData.id, {
          name: title.trim(),
          testimonial: description.trim(),
          videoUrl: youtubeUrl.trim(),
          type: "video",
          isActive,
        });
      } else {
        if (!programId) throw new Error("Program ID is missing.");
        await createProgramTestimonial(programId, {
          name: title.trim(),
          testimonial: description.trim(),
          videoUrl: youtubeUrl.trim(),
          type: "video",
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
          ? "Update the YouTube URL, title, description, and status."
          : "Add a YouTube Shorts or regular YouTube URL."
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
      {/* YouTube URL + live thumbnail preview */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">
          YouTube URL <span className="text-rose-500">*</span>
          <span className="ml-1 font-normal text-zinc-400">(Shorts or regular)</span>
        </label>
        <input
          type="url"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          className={INPUT_CLS}
          placeholder="https://www.youtube.com/shorts/... or watch?v=..."
        />
        {youtubeUrl && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-14 w-20 flex-shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
              {ytId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                  alt="Thumbnail preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                  Invalid
                </div>
              )}
            </div>
            {ytId ? (
              <span className="text-xs text-emerald-600">✓ Valid YouTube URL (ID: {ytId})</span>
            ) : (
              <span className="text-xs text-rose-500">Could not extract video ID</span>
            )}
          </div>
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

// ─── View Modal (dialog, not drawer — view-only content) ──────────────────────
function VideoViewModal({
  isOpen,
  onClose,
  row,
}: {
  isOpen: boolean;
  onClose: () => void;
  row: VideoTestimonyRow;
}) {
  if (!isOpen) return null;
  const embedUrl = toEmbedUrl(row.youtubeUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">{row.name}</h3>
            <p className="mt-1 text-sm text-zinc-500">Preview the embedded video.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-200 bg-black/90 shadow-inner">
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
                Invalid YouTube URL.
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500">YouTube URL</div>
              <a
                href={row.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm font-medium text-blue-600 underline underline-offset-2"
              >
                {row.youtubeUrl}
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
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Exported Action Buttons ───────────────────────────────────────────────────
export function AddVideoAction({
  programId,
  onSuccess,
}: {
  programId: string;
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
      <VideoViewModal isOpen={isOpen} onClose={() => setIsOpen(false)} row={row} />
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
