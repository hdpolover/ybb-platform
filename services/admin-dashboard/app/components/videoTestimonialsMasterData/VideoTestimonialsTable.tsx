"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CheckCircleIcon,
  PencilSquareIcon,
  PlayCircleIcon,
  PlusIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

export type VideoTestimonyRow = {
  id: number;
  thumbnailUrl?: string;
  youtubeUrl: string;
  description: string;
  status: "active" | "inactive";
};

const mockVideoTestimonials: VideoTestimonyRow[] = [
  {
    id: 1,
    thumbnailUrl: "/img/mock/video-thumb-1.jpg",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    description:
      "A short highlight video from delegates sharing their experience at Japan Youth Summit.",
    status: "active",
  },
  {
    id: 2,
    thumbnailUrl: "/img/mock/video-thumb-2.jpg",
    youtubeUrl: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
    description:
      "Alumni stories on how the program helped them build an international network.",
    status: "inactive",
  },
];

export function VideoTestimonialsTable() {
  const [rows] = useState<VideoTestimonyRow[]>(mockVideoTestimonials);
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRow, setEditingRow] = useState<VideoTestimonyRow | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<VideoTestimonyRow | null>(null);

  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.youtubeUrl.toLowerCase().includes(q) ||
      row.description.toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q)
    );
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Video Testimonials</h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Manage video testimonials embedded on the program landing pages.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={() => {
            setEditingRow(null);
            setShowFormModal(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Video</span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by URL, description, or status..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-sm md:text-sm">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-12 px-3 py-2">No</th>
              <th className="w-28 px-3 py-2">Video Thumbnail</th>
              <th className="px-3 py-2">YouTube URL</th>
              <th className="px-3 py-2">Description</th>
              <th className="w-28 px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-[12px] text-zinc-500"
                >
                  No video testimonials configured yet.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50"
                >
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                      {row.thumbnailUrl ? (
                        <Image
                          src={row.thumbnailUrl}
                          alt="Video thumbnail"
                          width={96}
                          height={64}
                          className="h-16 w-24 object-cover"
                        />
                      ) : (
                        <PlayCircleIcon className="h-10 w-10 text-zinc-300" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="max-w-xs break-all text-[11px] text-blue-700 underline underline-offset-2 md:max-w-sm">
                      {row.youtubeUrl}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="max-w-md text-[11px] text-zinc-700 line-clamp-4 md:max-w-xl">
                      {row.description}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        row.status === "active"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                          : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                      }`}
                    >
                      {row.status === "active" ? (
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                      ) : (
                        <XCircleIcon className="h-3.5 w-3.5" />
                      )}
                      <span className="capitalize">{row.status}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100"
                        aria-label="View video"
                        onClick={() => {
                          setSelectedRow(row);
                          setShowViewModal(true);
                        }}
                      >
                        <PlayCircleIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                        aria-label="Edit video testimonial"
                        onClick={() => {
                          setEditingRow(row);
                          setShowFormModal(true);
                        }}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                        aria-label="Delete video testimonial"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showFormModal && (
        <VideoTestimonyFormModal
          mode={editingRow ? "edit" : "add"}
          initialValues={editingRow ?? undefined}
          onClose={() => {
            setShowFormModal(false);
            setEditingRow(null);
          }}
        />
      )}

      {showViewModal && selectedRow && (
        <VideoTestimonyViewModal
          row={selectedRow}
          onClose={() => {
            setShowViewModal(false);
            setSelectedRow(null);
          }}
        />
      )}
    </section>
  );
}

interface VideoTestimonyFormModalProps {
  onClose: () => void;
  mode?: "add" | "edit";
  initialValues?: VideoTestimonyRow;
}

function VideoTestimonyFormModal({
  onClose,
  mode = "add",
  initialValues,
}: VideoTestimonyFormModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState(initialValues?.youtubeUrl ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(initialValues?.status ?? "active");

  const isEditMode = mode === "edit";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      youtubeUrl,
      description,
      status,
    };
    // TODO: Nanti disambungin ke backend / state di parent pas udah siap
    console.log(isEditMode ? "Edit video testimony:" : "Create video testimony:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Video Testimonial" : "Add Video Testimonial"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the YouTube URL, description, and status of this video."
                : "Add a new video testimonial using a valid YouTube URL."}
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-3">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                YouTube URL <span className="text-rose-500">*</span>
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Short description of what is covered in this video."
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "active" | "inactive")
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
            >
              {isEditMode ? "Save Changes" : "Add Video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface VideoTestimonyViewModalProps {
  row: VideoTestimonyRow;
  onClose: () => void;
}

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

function VideoTestimonyViewModal({ row, onClose }: VideoTestimonyViewModalProps) {
  const embedUrl = extractYouTubeEmbedUrl(row.youtubeUrl);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">View Video Testimonial</h3>
            <p className="text-[11px] text-zinc-500">Preview the embedded YouTube video and its details.</p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-4 py-3">
          <div className="aspect-video w-full overflow-hidden rounded-md border border-zinc-200 bg-black/80">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title="Video testimonial"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-zinc-200">
                Invalid YouTube URL. Unable to generate preview.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                YouTube URL
              </div>
              <div className="break-all text-xs text-blue-700 underline underline-offset-2">
                {row.youtubeUrl}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Description
              </div>
              <div className="whitespace-pre-line text-xs text-zinc-700">
                {row.description}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Status
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  row.status === "active"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                }`}
              >
                {row.status === "active" ? (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                ) : (
                  <XCircleIcon className="h-3.5 w-3.5" />
                )}
                <span className="capitalize">{row.status}</span>
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// TODO: Nanti implement VideoTestimonialsTable lengkap ngikutin pattern ProgramTestimoniesTable
