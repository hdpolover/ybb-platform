"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/solid";

export type ProgramPhoto = {
  id: number;
  title: string;
  year: string;
  imageUrl: string;
  description: string;
};

const mockPhotos: ProgramPhoto[] = [
  {
    id: 1,
    title: "Opening Plenary - Global Youth Leaders",
    year: "2025",
    imageUrl: "/img/mock/program-photo-1.jpg",
    description:
      "A global gathering of young leaders, innovators, and change-makers, focused on fostering cross-cultural collaboration, sharing insights, and driving action on pressing global issues.",
  },
  {
    id: 2,
    title: "Collaborative Sharing Session",
    year: "2025",
    imageUrl: "/img/mock/program-photo-2.jpg",
    description:
      "A collaborative session where delegates shared their experiences, insights, and ideas, fostering mutual learning and global exchange.",
  },
  {
    id: 3,
    title: "Delegates Group Photo",
    year: "2025",
    imageUrl: "/img/mock/program-photo-3.jpg",
    description:
      "A special moment for delegates to capture memories and celebrate their participation in the summit, creating lasting connections through group photos.",
  },
  {
    id: 4,
    title: "Certificate Awarding Ceremony",
    year: "2025",
    imageUrl: "/img/mock/program-photo-4.jpg",
    description:
      "A formal ceremony where delegates were recognized and awarded certificates for their active participation and contributions throughout the summit.",
  },
  {
    id: 5,
    title: "Networking & Community Building Night",
    year: "2025",
    imageUrl: "/img/mock/program-photo-5.jpg",
    description:
      "An interactive space for delegates to connect, exchange ideas, and build meaningful friendships in an inclusive environment.",
  },
  {
    id: 6,
    title: "Keynote Session with Speakers",
    year: "2025",
    imageUrl: "/img/mock/program-photo-6.jpg",
    description:
      "A dynamic session featuring inspiring speakers who shared insights, experiences, and knowledge on key topics, sparking meaningful discussions.",
  },
  {
    id: 7,
    title: "Awards & Recognition Moment",
    year: "2025",
    imageUrl: "/img/mock/program-photo-7.jpg",
    description:
      "A prestigious ceremony recognizing outstanding delegates and their contributions, celebrating achievements and leadership.",
  },
  {
    id: 8,
    title: "Project Presentation & Idea Exchange",
    year: "2025",
    imageUrl: "/img/mock/program-photo-8.jpg",
    description:
      "An interactive platform where delegates shared and discussed their projects, exchanging ideas and solutions in a dynamic and collaborative environment.",
  },
];

export function ProgramPhotosGallery() {
  const [photos] = useState<ProgramPhoto[]>(mockPhotos);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<ProgramPhoto | null>(null);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Photo Gallery</h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Manage highlight photos and short descriptions for this program.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={() => {
            setEditingPhoto(null);
            setShowFormModal(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add New Photo</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-xs text-zinc-500 md:text-sm">
            <p className="font-medium text-zinc-700">No photos added yet</p>
            <p className="mt-1 max-w-md text-[11px] text-zinc-500">
              Start building your gallery by uploading highlight photos from program activities.
            </p>
          </div>
        ) : (
          photos.map((photo) => (
            <article
              key={photo.id}
              className="flex h-full flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm"
            >
              <div className="relative h-40 w-full bg-zinc-100">
                <Image
                  src={photo.imageUrl}
                  alt="Program photo"
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between gap-2 px-3 py-2.5 text-xs text-zinc-700 md:text-sm">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold text-zinc-900 md:text-sm">
                    {photo.title}
                  </h3>
                  <p className="text-[11px] font-medium text-zinc-500">{photo.year}</p>
                  <p className="text-[11px] leading-relaxed text-zinc-700 md:text-sm">
                    {photo.description}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                    aria-label="Edit photo"
                    onClick={() => {
                      setEditingPhoto(photo);
                      setShowFormModal(true);
                    }}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                    aria-label="Delete photo"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {showFormModal && (
        <ProgramPhotoFormModal
          mode={editingPhoto ? "edit" : "add"}
          initialValues={editingPhoto ?? undefined}
          onClose={() => {
            setShowFormModal(false);
            setEditingPhoto(null);
          }}
        />
      )}
    </section>
  );
}

interface ProgramPhotoFormModalProps {
  onClose: () => void;
  mode?: "add" | "edit";
  initialValues?: ProgramPhoto;
}

function ProgramPhotoFormModal({
  onClose,
  mode = "add",
  initialValues,
}: ProgramPhotoFormModalProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [year, setYear] = useState(initialValues?.year ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [selectedImageName, setSelectedImageName] = useState<string | null>(
    initialValues?.imageUrl ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isEditMode = mode === "edit";

  const handleClickUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedImageName(file ? file.name : null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      title,
      year,
      description,
      imageFileName: selectedImageName,
    };
    // TODO: integrate with backend / parent state
    console.log(isEditMode ? "Edit program photo:" : "Add program photo:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Photo" : "Add New Photo"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the image and description for this program photo."
                : "Upload a new highlight photo and write a short description."}
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
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g., Opening Plenary - Global Youth Leaders"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                    Year <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g., 2025"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Write a short description about this moment or activity."
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Photo
                </div>
                <button
                  type="button"
                  className="flex h-40 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-center text-[11px] text-zinc-500 hover:border-blue-400 hover:bg-blue-50/40"
                  onClick={handleClickUpload}
                >
                  <div className="space-y-1 px-4">
                    <div className="text-sm font-medium text-zinc-700">
                      {selectedImageName
                        ? "Image selected"
                        : "Drop image here or click to upload."}
                    </div>
                    {selectedImageName ? (
                      <div className="truncate text-[11px] text-zinc-600">{selectedImageName}</div>
                    ) : (
                      <div>Recommended size: 1200x800px. Max size: 2MB</div>
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
              {isEditMode ? "Save Changes" : "Add Photo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// TODO: implement ProgramPhotosGallery component
