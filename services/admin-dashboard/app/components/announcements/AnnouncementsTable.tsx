"use client";

import React, { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EyeIcon, PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/solid";

interface AnnouncementRow {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  status: "Active" | "Inactive";
}

const mockAnnouncements: AnnouncementRow[] = [
  {
    id: 1,
    title: "Final Program Reminder - Travel & Packing Checklist",
    content:
      "Please review the updated travel guidelines, packing checklist, and airport pick-up details before your departure.",
    imageUrl: "/img/mock/announcement-travel.jpg",
    status: "Active",
  },
  {
    id: 2,
    title: "Scholarship Disbursement Schedule - Batch 1",
    content:
      "Scholarship disbursement for fully funded participants (Batch 1) will be processed between Dec 10-14, 2025.",
    imageUrl: "/img/mock/announcement-scholarship.jpg",
    status: "Active",
  },
  {
    id: 3,
    title: "Webinar Recording: Orientation & Code of Conduct",
    content:
      "If you missed the live orientation, you can now watch the full recording and download the slides.",
    imageUrl: "/img/mock/announcement-webinar.jpg",
    status: "Inactive",
  },
  {
    id: 4,
    title: "Deadline Extension: Agreement Letter Submission",
    content:
      "The deadline to upload signed Agreement Letters has been extended to Dec 7, 2025 (23:59 GMT+7).",
    imageUrl: "/img/mock/announcement-deadline.jpg",
    status: "Inactive",
  },
  {
    id: 5,
    title: "Important: Visa Interview Preparation Guide",
    content:
      "Read the step-by-step guide to prepare your documents and common questions for the visa interview.",
    imageUrl: "/img/mock/announcement-visa.jpg",
    status: "Active",
  },
];

export function AnnouncementsTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  type StatusFilter = "All" | "Active" | "Inactive";

  const filteredRows = useMemo(() => {
    return mockAnnouncements.filter((row) => {
      if (statusFilter !== "All" && row.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        row.title.toLowerCase().includes(query) ||
        row.content.toLowerCase().includes(query)
      );
    });
  }, [statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRows.length);
  const visibleRows = filteredRows.slice(startIndex, endIndex);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementRow | null>(null);

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:text-sm">
      {/* Buat bagian Toolbar */}
      <div className="mb-2.5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-600"
            onClick={() => setShowAddModal(true)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>Add Announcement</span>
          </button>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 text-[11px] md:flex-none">
          <select
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:w-40"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <div className="relative w-full md:w-56">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search announcement..."
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 pr-8 text-[11px] text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] text-zinc-400">
              ⌕
            </span>
          </div>
        </div>
      </div>

      {/* Bagian Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Content</th>
              <th className="px-3 py-2">Image</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[12px] text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No announcements found</span>
                    <span className="text-[11px] text-zinc-400">
                      Try adjusting the status filter or search keyword.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{startIndex + index + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-semibold text-zinc-900 line-clamp-2">{row.title}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="max-w-xs text-[11px] text-zinc-600 line-clamp-3 md:max-w-md">
                      {row.content}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.imageUrl ? (
                      <div className="flex h-10 w-16 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-zinc-50 text-[10px] text-zinc-400">
                        <span className="px-1 text-center">Preview</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <AnnouncementStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="inline-flex flex-wrap gap-1 text-[11px]">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams.toString());
                          params.set("source", "announcements");
                          const query = params.toString();
                          const match = pathname.match(/\/programs\/([^/]+)/);
                          const programId = match?.[1];
                          const basePath = programId
                            ? `/programs/${encodeURIComponent(programId)}/announcements/${encodeURIComponent(
                                row.id,
                              )}`
                            : `/announcements/${encodeURIComponent(row.id)}`;
                          router.push(query ? `${basePath}?${query}` : basePath);
                        }}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        onClick={() => {
                          setSelectedAnnouncement(row);
                          setShowEditModal(true);
                        }}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-600 shadow-sm hover:bg-rose-50"
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

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Showing {filteredRows.length === 0 ? 0 : startIndex + 1} to {endIndex} of {filteredRows.length} entries
        </span>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            disabled={clampedPage === 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
            disabled={clampedPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
      {showAddModal && <AddAnnouncementModal onClose={() => setShowAddModal(false)} />}
      {showEditModal && selectedAnnouncement && (
        <EditAnnouncementModal
          key={selectedAnnouncement.id}
          announcement={selectedAnnouncement}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </section>
  );
}

function AnnouncementStatusBadge({ status }: { status: AnnouncementRow["status"] }) {
  let className = "bg-zinc-100 text-zinc-700";

  if (status === "Active") className = "bg-emerald-100 text-emerald-700";
  else if (status === "Inactive") className = "bg-zinc-100 text-zinc-600";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}
    >
      {status}
    </span>
  );
}

function AddAnnouncementModal({ onClose }: { onClose: () => void }) {
  const [isActive, setIsActive] = useState(true);
  const [visibleTo, setVisibleTo] = useState("Public");
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggleStatus = () => {
    setIsActive((previous) => !previous);
  };

  const handleClickUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedImageName(file ? file.name : null);
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-5xl flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Create Announcement</h2>
            <p className="text-[11px] text-zinc-500">
              Configure the content, SEO, status, and featured image for this announcement.
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Title<span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Enter announcement title"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Content<span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={8}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Write your announcement content here..."
              />
            </div>

            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                SEO Settings
              </div>
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">Slug</label>
                  <input
                    type="text"
                    className="block w-full cursor-not-allowed rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 shadow-sm outline-none"
                    placeholder="Auto-generated from title. Will be used in URLs."
                    disabled
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">Meta Title</label>
                  <input
                    type="text"
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Optional: custom title for search engines"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">Meta Description</label>
                  <textarea
                    rows={3}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Short description that will appear in search results."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">Tags</label>
                  <input
                    type="text"
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Separate tags with commas."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Status</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-600">{isActive ? "Active" : "Inactive"}</span>
                <button
                  type="button"
                  className={`inline-flex h-6 w-11 items-center rounded-full px-0.5 text-[10px] font-medium shadow-inner transition-colors ${
                    isActive ? "bg-blue-500 text-white" : "bg-zinc-200 text-zinc-600"
                  }`}
                  onClick={handleToggleStatus}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-semibold shadow transition-transform ${
                      isActive ? "translate-x-5 text-blue-600" : "translate-x-0 text-zinc-500"
                    }`}
                  />
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">
                Inactive announcements will not be displayed to participants.
              </p>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Visible To</label>
                <select
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={visibleTo}
                  onChange={(event) => setVisibleTo(event.target.value)}
                >
                  <option value="Public">Public</option>
                  <option value="Participants only">Participants only</option>
                  <option value="Ambassadors only">Ambassadors only</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Featured Image</div>
              <button
                type="button"
                className="flex h-40 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-center text-[11px] text-zinc-500 hover:border-blue-400 hover:bg-blue-50/40"
                onClick={handleClickUpload}
              >
                <div className="space-y-1 px-4">
                  <div className="text-sm font-medium text-zinc-700">
                    {selectedImageName ? "Image selected" : "Drop image here or click to upload."}
                  </div>
                  {selectedImageName ? (
                    <div className="truncate text-[11px] text-zinc-600">{selectedImageName}</div>
                  ) : (
                    <div>Supported formats: JPG, PNG, GIF. Max size: 2MB</div>
                  )}
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-blue-600"
            onClick={onClose}
          >
            Create Announcement
          </button>
        </div>
      </div>
    </div>
  );
}

function EditAnnouncementModal({
  announcement,
  onClose,
}: {
  announcement: AnnouncementRow;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(announcement.title);
  const [content, setContent] = useState(announcement.content);
  const [isActive, setIsActive] = useState(announcement.status === "Active");
  const [visibleTo, setVisibleTo] = useState("Public");
  const [selectedImageName, setSelectedImageName] = useState<string | null>(
    announcement.imageUrl ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggleStatus = () => {
    setIsActive((previous) => !previous);
  };

  const handleClickUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedImageName(file ? file.name : null);
  };

  const handleSave = () => {
    const updated: AnnouncementRow = {
      ...announcement,
      title,
      content,
      status: isActive ? "Active" : "Inactive",
      imageUrl: selectedImageName || undefined,
    };

    // TODO: Nanti disambungin ke backend / state di parent pas API nya udah ready
    console.log("Updated announcement:", updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-5xl flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Edit Announcement</h2>
            <p className="text-[11px] text-zinc-500">
              Update the content, SEO, status, and featured image for this announcement.
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Title<span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Enter announcement title"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Content<span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={8}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Write your announcement content here..."
              />
            </div>

            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                SEO Settings
              </div>
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">Slug</label>
                  <input
                    type="text"
                    className="block w-full cursor-not-allowed rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 shadow-sm outline-none"
                    placeholder="Auto-generated from title. Will be used in URLs."
                    disabled
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">Meta Title</label>
                  <input
                    type="text"
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Optional: custom title for search engines"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">Meta Description</label>
                  <textarea
                    rows={3}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Short description that will appear in search results."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">Tags</label>
                  <input
                    type="text"
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Separate tags with commas."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Status</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-600">{isActive ? "Active" : "Inactive"}</span>
                <button
                  type="button"
                  className={`inline-flex h-6 w-11 items-center rounded-full px-0.5 text-[10px] font-medium shadow-inner transition-colors ${
                    isActive ? "bg-blue-500 text-white" : "bg-zinc-200 text-zinc-600"
                  }`}
                  onClick={handleToggleStatus}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-semibold shadow transition-transform ${
                      isActive ? "translate-x-5 text-blue-600" : "translate-x-0 text-zinc-500"
                    }`}
                  />
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">
                Inactive announcements will not be displayed to participants.
              </p>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Visible To</label>
                <select
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={visibleTo}
                  onChange={(event) => setVisibleTo(event.target.value)}
                >
                  <option value="Public">Public</option>
                  <option value="Participants only">Participants only</option>
                  <option value="Ambassadors only">Ambassadors only</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Featured Image</div>
              <button
                type="button"
                className="flex h-40 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-center text-[11px] text-zinc-500 hover:border-blue-400 hover:bg-blue-50/40"
                onClick={handleClickUpload}
              >
                <div className="space-y-1 px-4">
                  <div className="text-sm font-medium text-zinc-700">
                    {selectedImageName ? "Image selected" : "Drop image here or click to upload."}
                  </div>
                  {selectedImageName ? (
                    <div className="truncate text-[11px] text-zinc-600">{selectedImageName}</div>
                  ) : (
                    <div>Supported formats: JPG, PNG, GIF. Max size: 2MB</div>
                  )}
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-blue-600"
            onClick={handleSave}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
