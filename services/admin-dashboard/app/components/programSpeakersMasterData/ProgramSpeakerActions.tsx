"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserCircleIcon,
  EnvelopeIcon,
  PhotoIcon,
  XMarkIcon
} from "@heroicons/react/24/solid";
import type { ProgramSpeaker, SpeakerType, SpeakerStatus } from "./ProgramSpeakersTable";

// SEARCH COMPONENT (Shareable URL State)
export function SpeakerSearch({ initialSearch }: { initialSearch: string }) {
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
        placeholder="Search by name, organization, or session..."
        className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// FORM MODAL COMPONENT (Add & Edit)
function SpeakerFormModal({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: ProgramSpeaker;
}) {
  const [photoFileName, setPhotoFileName] = useState<string | null>(initialData?.photoUrl ?? null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;
  const isEditMode = !!initialData;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log(isEditMode ? "Edit Speaker Submitted" : "Add Speaker Submitted");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 text-left">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditMode ? "Edit Speaker" : "Add Speaker"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditMode
                ? "Update the speaker profile, contact, and assigned session information."
                : "Add a new speaker with basic profile, social links, and session details."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form id="speaker-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
              {/* Kolom Kiri */}
              <div className="space-y-6">
                <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
                  <div className="mb-4 border-b border-zinc-200 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Basic Information</h4>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-500">Speaker Name <span className="text-rose-500">*</span></label>
                      <input type="text" defaultValue={initialData?.name} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Title / Position</label>
                        <input type="text" defaultValue={initialData?.title} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Organization</label>
                        <input type="text" defaultValue={initialData?.organization} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      </div>
                    </div>
                    <div className="grid gap-5 md:grid-cols-3">
                      <div className="md:col-span-3 lg:col-span-1">
                        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Email</label>
                        <input type="email" defaultValue={initialData?.email} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Type <span className="text-rose-500">*</span></label>
                        <select defaultValue={initialData?.type || "Regular"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                          <option value="Regular">Regular</option>
                          <option value="Keynote">Keynote</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status <span className="text-rose-500">*</span></label>
                        <select defaultValue={initialData?.status || "Active"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-500">Biography</label>
                      <textarea rows={3} defaultValue={initialData?.biography} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-500">Expertise Areas</label>
                      <input type="text" defaultValue={initialData?.expertiseAreas} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
                  <div className="mb-4 border-b border-zinc-200 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Session Information</h4>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-500">Session Title</label>
                      <input type="text" defaultValue={initialData?.sessionTitle} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-500">Session Time</label>
                      <input type="text" defaultValue={initialData?.sessionTime} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </div>
                  </div>
                </section>
              </div>

              {/* Kolom Kanan */}
              <div className="space-y-6">
                <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
                  <div className="mb-4 border-b border-zinc-200 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Speaker Photo</h4>
                  </div>
                  <button
                    type="button"
                    className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-center transition hover:border-blue-400 hover:bg-blue-50/30"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                      <PhotoIcon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-700">
                        {photoFileName ? "Image Selected" : "Click to upload"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {photoFileName ?? "Max size: 2MB"}
                      </p>
                    </div>
                  </button>
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoFileName(e.target.files?.[0]?.name || null)} />
                </section>
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">
            Cancel
          </button>
          <button type="submit" form="speaker-form" className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
            {isEditMode ? "Save Changes" : "Add Speaker"}
          </button>
        </div>
      </div>
    </div>
  );
}

// DETAIL MODAL COMPONENT (View)
function SpeakerDetailModal({
  isOpen,
  onClose,
  speaker,
}: {
  isOpen: boolean;
  onClose: () => void;
  speaker: ProgramSpeaker;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6 text-left">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Speaker Details</h3>
            <p className="mt-1 text-sm text-zinc-500">Overview of the speaker profile and session.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-100 bg-zinc-50 shadow-sm">
              {speaker.photoUrl ? (
                <Image src={speaker.photoUrl} alt={speaker.name} width={96} height={96} className="h-full w-full object-cover" />
              ) : (
                <UserCircleIcon className="h-16 w-16 text-zinc-300" />
              )}
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-zinc-900">{speaker.name}</h2>
                <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${speaker.type === "Keynote" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700"}`}>
                  {speaker.type} Speaker
                </span>
              </div>
              <div className="text-sm text-zinc-600">
                {speaker.title} {speaker.title && speaker.organization ? " · " : ""} <span className="font-semibold text-zinc-800">{speaker.organization}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${speaker.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-600"}`}>
                  {speaker.status === "Active" ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                  <span>{speaker.status}</span>
                </span>
                {speaker.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <EnvelopeIcon className="h-4 w-4 text-zinc-400" /> {speaker.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Biography</h4>
                <p className="text-sm leading-relaxed text-zinc-700">{speaker.biography || "-"}</p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Session Information</h4>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-medium text-zinc-500">Title</div>
                  <div className="text-sm font-semibold text-zinc-900">{speaker.sessionTitle || "-"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-500">Time</div>
                  <div className="text-sm font-semibold text-zinc-900">{speaker.sessionTime || "-"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ACTION BUTTON EXPORTS
export function AddSpeakerAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Speaker</span>
      </button>
      <SpeakerFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function ViewSpeakerAction({ speaker }: { speaker: ProgramSpeaker }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-600 transition hover:bg-sky-100 hover:text-sky-700" 
        aria-label="View details"
      >
        <EyeIcon className="h-4 w-4" />
      </button>
      <SpeakerDetailModal isOpen={isOpen} onClose={() => setIsOpen(false)} speaker={speaker} />
    </>
  );
}

export function EditSpeakerAction({ speaker }: { speaker: ProgramSpeaker }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700" 
        aria-label="Edit speaker"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <SpeakerFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialData={speaker} />
    </>
  );
}

export function DeleteSpeakerAction({ id }: { id: number }) {
  return (
    <button 
      type="button" 
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700" 
      aria-label="Delete speaker"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}