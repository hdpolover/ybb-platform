"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PencilSquareIcon, PlayCircleIcon, PlusIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import type { VideoTestimonyRow } from "./VideoTestimonialsTable";

// SEARCH COMPONENT (Shareable URL State)
export function VideoSearch({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchTerm) {
        params.set("search", searchTerm);
      } else {
        params.delete("search");
      }
      router.push(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, pathname, router, searchParams]);

  return (
    <div className="w-full">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search by URL, description..."
        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// FORM MODAL COMPONENT (Internal)
function VideoFormModal({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: VideoTestimonyRow;
}) {
  if (!isOpen) return null;
  const isEditMode = !!initialData;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log(isEditMode ? "Edit Video:" : "Add Video:", "Submitted");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 text-left">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditMode ? "Edit Video Testimonial" : "Add Video Testimonial"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditMode
                ? "Update the YouTube URL, description, and status of this video."
                : "Add a new video testimonial using a valid YouTube URL."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <form id="video-form" onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              YouTube URL <span className="text-rose-500">*</span>
            </label>
            <input type="url" defaultValue={initialData?.youtubeUrl} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="https://www.youtube.com/watch?v=..." required />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea rows={4} defaultValue={initialData?.description} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Short description of what is covered in this video." required />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                Status <span className="text-rose-500">*</span>
              </label>
              <select defaultValue={initialData?.status || "active"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">Cancel</button>
          <button type="submit" form="video-form" className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// VIEW MODAL COMPONENT (Internal)
function extractYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (parsed.hostname === "youtu.be") {
      const videoId = parsed.pathname.replace("/", "");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    return null;
  } catch {
    return null;
  }
}

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
  const embedUrl = extractYouTubeEmbedUrl(row.youtubeUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 text-left">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">View Video Testimonial</h3>
            <p className="mt-1 text-sm text-zinc-500">Preview the embedded YouTube video and its details.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-200 bg-black/90 shadow-inner">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title="Video testimonial"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-medium text-zinc-300">
                Invalid YouTube URL. Unable to generate preview.
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
            <div>
              <div className="text-xs font-medium text-zinc-500 mb-1">YouTube URL</div>
              <div className="break-all text-sm font-medium text-blue-600 underline underline-offset-2">
                {row.youtubeUrl}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-500 mb-1">Status</div>
              <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${row.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-600"}`}>
                {row.status === "active" ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                <span>{row.status}</span>
              </span>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-500 mb-1">Description</div>
              <div className="text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
                {row.description}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ACTION BUTTON EXPORTS
export function AddVideoAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Video</span>
      </button>
      <VideoFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
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

export function EditVideoAction({ row }: { row: VideoTestimonyRow }) {
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
      <VideoFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialData={row} />
    </>
  );
}

export function DeleteVideoAction({ id }: { id: number }) {
  return (
    <button 
      type="button" 
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700" 
      title="Delete Video"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}