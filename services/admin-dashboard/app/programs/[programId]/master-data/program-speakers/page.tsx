"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  UserCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/app/contexts/AuthContext";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import {
  listProgramSpeakers,
  createProgramSpeaker,
  updateProgramSpeaker,
  deleteProgramSpeaker,
  type ProgramSpeaker,
} from "@/src/shared/api-client";

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

interface SpeakerFormState {
  id?: string;
  name: string;
  title: string;
  organization: string;
  bio: string;
  email: string;
  linkedinUrl: string;
  order: string;
}

function emptyForm(): SpeakerFormState {
  return { name: "", title: "", organization: "", bio: "", email: "", linkedinUrl: "", order: "0" };
}

function toForm(s: ProgramSpeaker): SpeakerFormState {
  return {
    id: s.id,
    name: s.name,
    title: s.title ?? "",
    organization: s.organization ?? "",
    bio: s.bio ?? "",
    email: s.email ?? "",
    linkedinUrl: s.linkedinUrl ?? "",
    order: String(s.order ?? 0),
  };
}

function SpeakerDrawer({
  programId,
  isOpen,
  formState,
  onChange,
  onClose,
  onSubmit,
  isSaving,
  errorMessage,
  photoFile,
  photoPreview,
  onPhotoChange,
}: {
  programId: string;
  isOpen: boolean;
  formState: SpeakerFormState;
  onChange: (patch: Partial<SpeakerFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  errorMessage: string | null;
  photoFile: File | null;
  photoPreview: string | null;
  onPhotoChange: (file: File) => void;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(formState.id);

  return (
    <DrawerShell
      open={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Speaker" : "Add Speaker"}
      description="Configure speaker details for this program."
      error={errorMessage}
      locked={isSaving}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSaving}
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Add Speaker"}
          </button>
        </>
      }
    >
      {/* Photo upload */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Photo</label>
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="group relative flex h-32 w-32 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 transition hover:border-blue-400 hover:bg-blue-50/30"
        >
          {photoPreview ? (
            <>
              <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                <span className="hidden rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-zinc-700 group-hover:block">
                  Change
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-zinc-400">
              <UserCircleIcon className="h-10 w-10" />
              <span className="text-xs font-medium">Click to upload</span>
            </div>
          )}
        </button>
        {photoFile && <p className="mt-1 truncate text-xs text-zinc-500">{photoFile.name}</p>}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPhotoChange(file);
          }}
        />
      </div>

      {/* Name */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formState.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Full name"
          className={INPUT_CLS}
        />
      </div>

      {/* Title + Organization */}
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Title / Position</label>
          <input
            type="text"
            value={formState.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g., CEO"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Organization</label>
          <input
            type="text"
            value={formState.organization}
            onChange={(e) => onChange({ organization: e.target.value })}
            placeholder="Company / Institution"
            className={INPUT_CLS}
          />
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Biography</label>
        <textarea
          rows={4}
          value={formState.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
          placeholder="Short bio (optional)"
          className={INPUT_CLS}
        />
      </div>

      {/* Email + LinkedIn */}
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Email</label>
          <input
            type="email"
            value={formState.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="speaker@example.com"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">LinkedIn URL</label>
          <input
            type="url"
            value={formState.linkedinUrl}
            onChange={(e) => onChange({ linkedinUrl: e.target.value })}
            placeholder="https://linkedin.com/in/..."
            className={INPUT_CLS}
          />
        </div>
      </div>

      {/* Display Order */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Display Order</label>
        <input
          type="number"
          value={formState.order}
          onChange={(e) => onChange({ order: e.target.value })}
          className={INPUT_CLS}
        />
      </div>
    </DrawerShell>
  );
}

export default function ProgramSpeakersPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const [speakers, setSpeakers] = useState<ProgramSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"order-asc" | "order-desc" | "name-asc" | "name-desc">("order-asc");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<SpeakerFormState>(emptyForm());
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const programName =
    accessiblePrograms.find((p) => p.programId === params.programId)?.programName ?? "Selected Program";

  const fetchSpeakers = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true);
    setPageError(null);
    try {
      const data = await listProgramSpeakers(params.programId);
      setSpeakers(data);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to load speakers");
    } finally {
      setLoading(false);
    }
  }, [params.programId]);

  useEffect(() => { void fetchSpeakers(); }, [fetchSpeakers]);

  const organizationOptions = useMemo(
    () => Array.from(new Set(speakers.map((speaker) => (speaker.organization ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [speakers],
  );

  const filteredSpeakers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...speakers]
      .filter((speaker) => {
        const matchesSearch = !normalizedSearch || [speaker.name, speaker.title ?? "", speaker.organization ?? "", speaker.bio ?? ""].join(" ").toLowerCase().includes(normalizedSearch);
        const matchesOrganization = organizationFilter === "all" || (speaker.organization ?? "").trim() === organizationFilter;
        return matchesSearch && matchesOrganization;
      })
      .sort((left, right) => compareSpeakers(left, right, sortBy));
  }, [speakers, searchTerm, organizationFilter, sortBy]);

  function resetFilters() {
    setSearchTerm("");
    setOrganizationFilter("all");
    setSortBy("order-asc");
  }

  function openCreate() {
    setFormState(emptyForm());
    setPhotoFile(null);
    setPhotoPreview(null);
    setDrawerError(null);
    setIsDrawerOpen(true);
  }

  function openEdit(s: ProgramSpeaker) {
    setFormState(toForm(s));
    setPhotoFile(null);
    setPhotoPreview(s.photoUrl ?? null);
    setDrawerError(null);
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setDrawerError(null);
  }

  function handlePhotoChange(file: File) {
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!formState.name.trim()) {
      setDrawerError("Name is required.");
      return;
    }

    setIsSaving(true);
    setDrawerError(null);

    const payload = {
      name: formState.name.trim(),
      title: formState.title.trim() || undefined,
      organization: formState.organization.trim() || undefined,
      bio: formState.bio.trim() || undefined,
      email: formState.email.trim() || undefined,
      linkedinUrl: formState.linkedinUrl.trim() || undefined,
      order: Number(formState.order) || 0,
      ...(photoFile ? { photo: photoFile } : {}),
    };

    try {
      if (formState.id) {
        await updateProgramSpeaker(formState.id, payload);
      } else {
        await createProgramSpeaker(params.programId, payload);
      }
      await fetchSpeakers();
      closeDrawer();
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : "Failed to save speaker.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(s: ProgramSpeaker) {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    setDeletingId(s.id);
    try {
      await deleteProgramSpeaker(s.id);
      await fetchSpeakers();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Master Data
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Speakers</h1>
        <p className="text-sm text-zinc-500">Manage speakers for this program.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">Showing {filteredSpeakers.length} of {speakers.length} speaker(s)</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void fetchSpeakers()}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              <PlusIcon className="h-4 w-4" />
              Add Speaker
            </button>
          </div>
        </div>

        {pageError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{pageError}</span>
          </div>
        )}

        <div className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, title, organization..."
                  className="block w-full rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Organization</label>
              <select value={organizationFilter} onChange={(e) => setOrganizationFilter(e.target.value)} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="all">All organizations</option>
                {organizationOptions.map((organization) => <option key={organization} value={organization}>{organization}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="order-asc">Order: low to high</option>
                <option value="order-desc">Order: high to low</option>
                <option value="name-asc">Name: A-Z</option>
                <option value="name-desc">Name: Z-A</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={resetFilters} className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50">Reset filters</button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="w-12 px-6 py-4 font-semibold">No</th>
                  <th className="px-6 py-4 font-semibold">Speaker</th>
                  <th className="px-6 py-4 font-semibold">Title / Organization</th>
                  <th className="w-16 px-6 py-4 font-semibold">Order</th>
                  <th className="px-6 py-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                      Loading speakers...
                    </td>
                  </tr>
                ) : speakers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No speakers configured yet.
                    </td>
                  </tr>
                ) : filteredSpeakers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No speakers match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredSpeakers.map((s, idx) => (
                    <tr key={s.id} className="transition-colors hover:bg-zinc-50/50">
                      <td className="px-6 py-4 align-middle text-xs font-medium text-zinc-500">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200">
                            {s.photoUrl ? (
                              <img src={s.photoUrl} alt={s.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-zinc-400">
                                <UserCircleIcon className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-zinc-900">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle text-zinc-600">
                        {[s.title, s.organization].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-6 py-4 align-middle text-zinc-600">{s.order}</td>
                      <td className="px-6 py-4 align-middle text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(s)}
                            disabled={deletingId === s.id}
                            className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>
      </section>

      <SpeakerDrawer
        programId={params.programId}
        isOpen={isDrawerOpen}
        formState={formState}
        onChange={(patch) => setFormState((cur) => ({ ...cur, ...patch }))}
        onClose={closeDrawer}
        onSubmit={() => void handleSave()}
        isSaving={isSaving}
        errorMessage={drawerError}
        photoFile={photoFile}
        photoPreview={photoPreview}
        onPhotoChange={handlePhotoChange}
      />
    </main>
  );
}

function compareSpeakers(
  left: ProgramSpeaker,
  right: ProgramSpeaker,
  sortBy: "order-asc" | "order-desc" | "name-asc" | "name-desc",
): number {
  if (sortBy === "name-asc") return left.name.localeCompare(right.name);
  if (sortBy === "name-desc") return right.name.localeCompare(left.name);
  if (sortBy === "order-desc") return right.order - left.order || left.name.localeCompare(right.name);
  return left.order - right.order || left.name.localeCompare(right.name);
}
