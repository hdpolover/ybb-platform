"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  CheckCircleIcon,
  EnvelopeIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

export type SpeakerType = "Regular" | "Keynote";
export type SpeakerStatus = "Active" | "Inactive";

export type ProgramSpeaker = {
  id: number;
  name: string;
  title?: string;
  organization?: string;
  email?: string;
  type: SpeakerType;
  status: SpeakerStatus;
  biography?: string;
  expertiseAreas?: string;
  photoUrl?: string;
  linkedInUrl?: string;
  instagramUrl?: string;
  sessionTitle?: string;
  sessionTime?: string;
  sessionDescription?: string;
};

export const mockSpeakers: ProgramSpeaker[] = [
  {
    id: 1,
    name: "Dr. Hana Nakamura",
    title: "Professor of International Relations",
    organization: "Tokyo Global University",
    email: "hana.nakamura@example.com",
    type: "Keynote",
    status: "Active",
    biography:
      "Dr. Hana has over 15 years of experience working on youth diplomacy, peacebuilding, and cross-cultural leadership programs across Asia and Europe.",
    expertiseAreas: "Youth Diplomacy, Peacebuilding, Global Governance",
    photoUrl: "/img/mock/speaker-hana.jpg",
    linkedInUrl: "https://www.linkedin.com/in/hananakamura",
    instagramUrl: "https://www.instagram.com/hanaspeaks",
    sessionTitle: "Youth as Catalysts for Global Change",
    sessionTime: "Day 1, 09:00 - 10:30",
    sessionDescription:
      "A keynote session exploring how young leaders can shape global narratives and drive impact through collaboration.",
  },
  {
    id: 2,
    name: "Michael Tan",
    title: "Social Innovation Strategist",
    organization: "ImpactBridge Asia",
    email: "michael.tan@example.com",
    type: "Regular",
    status: "Active",
    biography:
      "Michael works with youth-led organizations to design social innovation projects and sustainable community programs.",
    expertiseAreas: "Social Innovation, Design Thinking, Community Development",
    photoUrl: "/img/mock/speaker-michael.jpg",
    linkedInUrl: "https://www.linkedin.com/in/michaeltan",
    sessionTitle: "Design Thinking for Youth-Led Projects",
    sessionTime: "Day 1, 13:30 - 15:00",
    sessionDescription:
      "A hands-on workshop guiding participants to design impactful and feasible community initiatives.",
  },
  {
    id: 3,
    name: "Aisha Rahman",
    title: "Program Manager",
    organization: "Global Youth Network",
    email: "aisha.rahman@example.com",
    type: "Regular",
    status: "Inactive",
    biography:
      "Aisha manages international youth exchange programs and facilitates leadership camps across multiple countries.",
    expertiseAreas: "Exchange Programs, Youth Leadership, Facilitation",
    photoUrl: "/img/mock/speaker-aisha.jpg",
    linkedInUrl: "https://www.linkedin.com/in/aisharahman",
    sessionTitle: "Building Sustainable Youth Networks",
    sessionTime: "Day 2, 10:00 - 11:30",
    sessionDescription:
      "An interactive session on how to maintain and grow international youth communities.",
  },
];

export function getSpeakerStats(speakers: ProgramSpeaker[]) {
  const totalSpeakers = speakers.length;
  const totalKeynote = speakers.filter((speaker) => speaker.type === "Keynote").length;
  const totalRegular = speakers.filter((speaker) => speaker.type === "Regular").length;
  const totalWithSession = speakers.filter((speaker) => speaker.sessionTitle && speaker.sessionTitle.trim()).length;

  return {
    totalSpeakers,
    totalKeynote,
    totalRegular,
    totalWithSession,
  };
}

export function ProgramSpeakersList() {
  const [speakers] = useState<ProgramSpeaker[]>(mockSpeakers);
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<ProgramSpeaker | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<ProgramSpeaker | null>(null);

  const filtered = speakers.filter((speaker) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      speaker.name.toLowerCase().includes(q) ||
      (speaker.title ?? "").toLowerCase().includes(q) ||
      (speaker.organization ?? "").toLowerCase().includes(q) ||
      speaker.type.toLowerCase().includes(q) ||
      (speaker.sessionTitle ?? "").toLowerCase().includes(q) ||
      speaker.status.toLowerCase().includes(q)
    );
  });

  return (
    <section className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program Speakers</h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Manage speakers, their profiles, and assigned sessions for this program.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={() => {
            setEditingSpeaker(null);
            setShowFormModal(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Speaker</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, title, organization, or session..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Speakers grid - layout mengikuti Program Photos gallery */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-xs text-zinc-500 md:text-sm">
            <p className="font-medium text-zinc-700">No speakers configured yet</p>
            <p className="mt-1 max-w-md text-[11px] text-zinc-500">
              Add keynote and regular speakers to build the program agenda and sessions.
            </p>
          </div>
        ) : (
          filtered.map((speaker, index) => (
            <article
              key={speaker.id}
              className="flex h-full flex-col overflow-hidden rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-sm md:text-sm"
            >
              {/* Top: photo / avatar with index badge */}
              <div className="relative h-32 w-full bg-zinc-100">
                {speaker.photoUrl ? (
                  <Image
                    src={speaker.photoUrl}
                    alt={speaker.name}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-300">
                    <UserCircleIcon className="h-12 w-12" />
                  </div>
                )}
                <div className="absolute left-2 top-2 inline-flex h-6 items-center justify-center rounded-full bg-blue-600 px-2 text-[10px] font-semibold text-white">
                  #{index + 1}
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col justify-between gap-2 px-3 py-2.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-xs font-semibold text-zinc-900 md:text-sm">{speaker.name}</h3>
                    {speaker.type && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          speaker.type === "Keynote"
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                            : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                        }`}
                      >
                        {speaker.type === "Keynote" ? "Keynote" : "Regular"} Speaker
                      </span>
                    )}
                  </div>

                  {(speaker.title || speaker.organization) && (
                    <div className="text-[11px] text-zinc-600 md:text-xs">
                      {speaker.title}
                      {speaker.title && speaker.organization ? " · " : ""}
                      {speaker.organization}
                    </div>
                  )}

                  {speaker.sessionTitle && (
                    <div className="text-[11px] text-zinc-600 md:text-xs">
                      <span className="font-medium text-zinc-700">Session:</span> {speaker.sessionTitle}
                    </div>
                  )}

                  {speaker.sessionTime && (
                    <div className="text-[11px] text-zinc-500 md:text-[11px]">{speaker.sessionTime}</div>
                  )}

                  {/* Status & email */}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        speaker.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                          : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                      }`}
                    >
                      {speaker.status === "Active" ? (
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                      ) : (
                        <XCircleIcon className="h-3.5 w-3.5" />
                      )}
                      <span>{speaker.status}</span>
                    </span>
                    {speaker.email && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-600 md:text-xs">
                        <EnvelopeIcon className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[140px] md:max-w-[180px]">{speaker.email}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100"
                    aria-label="View speaker details"
                    onClick={() => {
                      setSelectedSpeaker(speaker);
                      setShowDetailModal(true);
                    }}
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                    aria-label="Edit speaker"
                    onClick={() => {
                      setEditingSpeaker(speaker);
                      setShowFormModal(true);
                    }}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                    aria-label="Delete speaker"
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
        <ProgramSpeakerFormModal
          mode={editingSpeaker ? "edit" : "add"}
          initialValues={editingSpeaker ?? undefined}
          onClose={() => {
            setShowFormModal(false);
            setEditingSpeaker(null);
          }}
        />
      )}

      {showDetailModal && selectedSpeaker && (
        <ProgramSpeakerDetailModal
          speaker={selectedSpeaker}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedSpeaker(null);
          }}
        />
      )}
    </section>
  );
}

type SpeakerFormMode = "add" | "edit";

interface ProgramSpeakerFormModalProps {
  onClose: () => void;
  mode?: SpeakerFormMode;
  initialValues?: ProgramSpeaker;
}

function ProgramSpeakerFormModal({
  onClose,
  mode = "add",
  initialValues,
}: ProgramSpeakerFormModalProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [organization, setOrganization] = useState(initialValues?.organization ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [type, setType] = useState<SpeakerType>(initialValues?.type ?? "Regular");
  const [status, setStatus] = useState<SpeakerStatus>(initialValues?.status ?? "Active");
  const [biography, setBiography] = useState(initialValues?.biography ?? "");
  const [expertiseAreas, setExpertiseAreas] = useState(initialValues?.expertiseAreas ?? "");

  const [photoFileName, setPhotoFileName] = useState<string | null>(initialValues?.photoUrl ?? null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [linkedInUrl, setLinkedInUrl] = useState(initialValues?.linkedInUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initialValues?.instagramUrl ?? "");

  const [sessionTitle, setSessionTitle] = useState(initialValues?.sessionTitle ?? "");
  const [sessionTime, setSessionTime] = useState(initialValues?.sessionTime ?? "");
  const [sessionDescription, setSessionDescription] = useState(
    initialValues?.sessionDescription ?? "",
  );

  const isEditMode = mode === "edit";

  const handleClickUploadPhoto = () => {
    if (photoInputRef.current) {
      photoInputRef.current.click();
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhotoFileName(file ? file.name : null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: ProgramSpeaker = {
      id: initialValues?.id ?? Date.now(),
      name,
      title,
      organization,
      email,
      type,
      status,
      biography,
      expertiseAreas,
      photoUrl: photoFileName ?? undefined,
      linkedInUrl,
      instagramUrl,
      sessionTitle,
      sessionTime,
      sessionDescription,
    };
    // TODO: integrate with backend / parent state
    console.log(isEditMode ? "Edit program speaker:" : "Create program speaker:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-5xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Speaker" : "Add Speaker"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the speaker profile, contact, and assigned session information."
                : "Add a new speaker with basic profile, social links, and session details."}
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
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            {/* Left: basic info + session */}
            <div className="space-y-3">
              {/* Basic Information */}
              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Basic Information
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                      Speaker Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="e.g., Dr. Hana Nakamura"
                      required
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                        Title / Position
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="e.g., Professor of International Relations"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                        Organization
                      </label>
                      <input
                        type="text"
                        value={organization}
                        onChange={(event) => setOrganization(event.target.value)}
                        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="e.g., Tokyo Global University"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="e.g., speaker@example.com"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                          Speaker Type <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={type}
                          onChange={(event) =>
                            setType(event.target.value as SpeakerType)
                          }
                          className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="Regular">Regular Speaker</option>
                          <option value="Keynote">Keynote Speaker</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                          Status <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={status}
                          onChange={(event) =>
                            setStatus(event.target.value as SpeakerStatus)
                          }
                          className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                      Biography
                    </label>
                    <textarea
                      rows={3}
                      value={biography}
                      onChange={(event) => setBiography(event.target.value)}
                      className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Short biography or background of the speaker."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                      Expertise Areas
                    </label>
                    <input
                      type="text"
                      value={expertiseAreas}
                      onChange={(event) => setExpertiseAreas(event.target.value)}
                      className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="e.g., Youth Leadership, Social Innovation, Diplomacy"
                    />
                  </div>
                </div>
              </div>

              {/* Session Information */}
              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Session Information
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                      Session Title
                    </label>
                    <input
                      type="text"
                      value={sessionTitle}
                      onChange={(event) => setSessionTitle(event.target.value)}
                      className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="e.g., Youth as Catalysts for Global Change"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                      Session Time
                    </label>
                    <input
                      type="text"
                      value={sessionTime}
                      onChange={(event) => setSessionTime(event.target.value)}
                      className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="e.g., Day 1, 09:00 - 10:30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                      Session Description
                    </label>
                    <textarea
                      rows={3}
                      value={sessionDescription}
                      onChange={(event) => setSessionDescription(event.target.value)}
                      className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Short description of the session content and objectives."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Photo + Social links */}
            <div className="space-y-3">
              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Speaker Photo
                </div>
                <button
                  type="button"
                  className="flex h-40 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-center text-[11px] text-zinc-500 hover:border-blue-400 hover:bg-blue-50/40"
                  onClick={handleClickUploadPhoto}
                >
                  <div className="space-y-1 px-4">
                    <div className="text-sm font-medium text-zinc-700">
                      {photoFileName ? "Image selected" : "Drop image here or click to upload."}
                    </div>
                    {photoFileName ? (
                      <div className="truncate text-[11px] text-zinc-600">{photoFileName}</div>
                    ) : (
                      <div>Recommended size: 800x800px. Max size: 2MB</div>
                    )}
                  </div>
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Social Media & Links
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      value={linkedInUrl}
                      onChange={(event) => setLinkedInUrl(event.target.value)}
                      className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="https://www.linkedin.com/in/username"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                      Instagram URL
                    </label>
                    <input
                      type="url"
                      value={instagramUrl}
                      onChange={(event) => setInstagramUrl(event.target.value)}
                      className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="https://www.instagram.com/username"
                    />
                  </div>
                </div>
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
              {isEditMode ? "Save Changes" : "Add Speaker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProgramSpeakerDetailModalProps {
  speaker: ProgramSpeaker;
  onClose: () => void;
}

function ProgramSpeakerDetailModal({ speaker, onClose }: ProgramSpeakerDetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Speaker Details</h3>
            <p className="text-[11px] text-zinc-500">Overview of the speaker profile and session.</p>
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
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-zinc-100">
              {speaker.photoUrl ? (
                <Image
                  src={speaker.photoUrl}
                  alt={speaker.name}
                  width={80}
                  height={80}
                  className="h-20 w-20 object-cover"
                />
              ) : (
                <UserCircleIcon className="h-16 w-16 text-zinc-300" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="text-sm font-semibold text-zinc-900 md:text-base">
                  {speaker.name}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    speaker.type === "Keynote"
                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                      : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                  }`}
                >
                  {speaker.type === "Keynote" ? "Keynote" : "Regular"} Speaker
                </span>
              </div>
              {(speaker.title || speaker.organization) && (
                <div className="text-[11px] text-zinc-600 md:text-xs">
                  {speaker.title}
                  {speaker.title && speaker.organization ? " · " : ""}
                  {speaker.organization}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 md:text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    speaker.status === "Active"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                      : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                  }`}
                >
                  {speaker.status === "Active" ? (
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                  ) : (
                    <XCircleIcon className="h-3.5 w-3.5" />
                  )}
                  <span>{speaker.status}</span>
                </span>
                {speaker.email && (
                  <span className="inline-flex items-center gap-1">
                    <EnvelopeIcon className="h-3.5 w-3.5" />
                    <span>{speaker.email}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {speaker.biography && (
            <div className="space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Biography
              </div>
              <div className="whitespace-pre-line text-xs text-zinc-700 md:text-sm">
                {speaker.biography}
              </div>
            </div>
          )}

          {speaker.expertiseAreas && (
            <div className="space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Expertise Areas
              </div>
              <div className="text-xs text-zinc-700 md:text-sm">{speaker.expertiseAreas}</div>
            </div>
          )}

          {(speaker.linkedInUrl || speaker.instagramUrl) && (
            <div className="space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Social Media & Links
              </div>
              <div className="space-y-1 text-xs text-zinc-700 md:text-sm">
                {speaker.linkedInUrl && (
                  <div>
                    <span className="font-medium">LinkedIn: </span>
                    <a
                      href={speaker.linkedInUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-blue-700 underline underline-offset-2"
                    >
                      {speaker.linkedInUrl}
                    </a>
                  </div>
                )}
                {speaker.instagramUrl && (
                  <div>
                    <span className="font-medium">Instagram: </span>
                    <a
                      href={speaker.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-blue-700 underline underline-offset-2"
                    >
                      {speaker.instagramUrl}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {(speaker.sessionTitle || speaker.sessionTime || speaker.sessionDescription) && (
            <div className="space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Session Information
              </div>
              {speaker.sessionTitle && (
                <div>
                  <span className="font-medium">Title: </span>
                  <span>{speaker.sessionTitle}</span>
                </div>
              )}
              {speaker.sessionTime && (
                <div>
                  <span className="font-medium">Time: </span>
                  <span>{speaker.sessionTime}</span>
                </div>
              )}
              {speaker.sessionDescription && (
                <div className="whitespace-pre-line text-xs text-zinc-700 md:text-sm">
                  {speaker.sessionDescription}
                </div>
              )}
            </div>
          )}

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
