"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon, ArrowPathIcon, UserCircleIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  listProgramSpeakers,
  createProgramSpeaker,
  updateProgramSpeaker,
  deleteProgramSpeaker,
  type ProgramSpeaker,
} from "@/src/shared/api-client";

export default function ProgramSpeakersPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const [speakers, setSpeakers] = useState<ProgramSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramSpeaker | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramSpeaker | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const programName =
    accessiblePrograms.find((p) => p.programId === params.programId)?.programName ?? "Selected Program";

  const fetchSpeakers = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listProgramSpeakers(params.programId);
      setSpeakers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load speakers");
    } finally {
      setLoading(false);
    }
  }, [params.programId]);

  useEffect(() => { fetchSpeakers(); }, [fetchSpeakers]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteProgramSpeaker(deleteTarget.id);
      setDeleteTarget(null);
      fetchSpeakers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Master Data</div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Speakers</h1>
        <p className="text-sm text-zinc-500">Manage speakers for this program.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">{speakers.length} speaker(s)</p>
          <div className="flex gap-2">
            <button type="button" onClick={fetchSpeakers} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add Speaker</button>
          </div>
        </div>

        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Title / Org</th>
                <th className="px-3 py-2 font-semibold">Keynote</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="px-3 py-6 text-center text-zinc-400">Loading…</td></tr>}
              {!loading && speakers.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-zinc-400">No speakers yet.</td></tr>}
              {!loading && speakers.map((s, idx) => (
                <tr key={s.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200">
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={s.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-400">
                            <UserCircleIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-zinc-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{[s.title, s.organization].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2">{s.isKeynote ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Keynote</span> : <span className="text-zinc-400">—</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setEditTarget(s)} className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"><PencilSquareIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setDeleteTarget(s)} className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && <SpeakerModal programId={params.programId} onClose={() => setShowCreate(false)} onSaved={fetchSpeakers} />}
      {editTarget && <SpeakerModal programId={params.programId} speaker={editTarget} onClose={() => setEditTarget(null)} onSaved={fetchSpeakers} />}
      {deleteTarget && (
        <ConfirmDelete name={deleteTarget.name} loading={deleteLoading} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </main>
  );
}

function SpeakerModal({ programId, speaker, onClose, onSaved }: { programId: string; speaker?: ProgramSpeaker; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!speaker;
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(speaker?.name ?? "");
  const [title, setTitle] = useState(speaker?.title ?? "");
  const [organization, setOrganization] = useState(speaker?.organization ?? "");
  const [bio, setBio] = useState(speaker?.bio ?? "");
  const [isKeynote, setIsKeynote] = useState(speaker?.isKeynote ?? false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(speaker?.photoUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isEdit && speaker) {
        await updateProgramSpeaker(speaker.id, {
          name, title, organization, bio, isKeynote,
          ...(photoFile ? { photo: photoFile } : {}),
        });
      } else {
        await createProgramSpeaker(programId, {
          name, title, organization, bio, isKeynote,
          ...(photoFile ? { photo: photoFile } : {}),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">{isEdit ? "Edit Speaker" : "Add Speaker"}</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {isEdit ? "Update the speaker's profile and session information." : "Add a new speaker to this program."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto">
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-[1fr_160px]">
            {/* Left: text fields */}
            <div className="space-y-3">
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>}
              <Field label="Name" required>
                <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title / Position">
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., CEO" className={inputCls} />
                </Field>
                <Field label="Organization">
                  <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Company / Institution" className={inputCls} />
                </Field>
              </div>
              <Field label="Biography">
                <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio (optional)" className={`${inputCls} resize-none`} />
              </Field>
              <div className="flex items-center gap-2 pt-1">
                <input
                  id={`keynote-${speaker?.id ?? "new"}`}
                  type="checkbox"
                  checked={isKeynote}
                  onChange={(e) => setIsKeynote(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-500"
                />
                <label htmlFor={`keynote-${speaker?.id ?? "new"}`} className="text-[11px] font-medium text-zinc-700">
                  Keynote speaker
                </label>
              </div>
            </div>

            {/* Right: photo upload */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium text-zinc-700">Photo</span>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="group relative flex h-40 w-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 transition hover:border-blue-400 hover:bg-blue-50/30"
              >
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                      <span className="hidden rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold text-zinc-700 group-hover:block">Change</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <UserCircleIcon className="h-10 w-10" />
                    <span className="text-[10px] font-medium">Click to upload</span>
                  </div>
                )}
              </button>
              {photoFile && <p className="truncate text-[10px] text-zinc-500">{photoFile.name}</p>}
              {isEdit && !photoFile && speaker?.photoUrl && (
                <p className="text-[10px] text-zinc-400">Existing photo kept</p>
              )}
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3">
            <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-md bg-blue-500 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600 disabled:opacity-60">
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Speaker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDelete({ name, loading, onCancel, onConfirm }: { name: string; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete?</h2>
        <p className="text-[11px] text-zinc-600">Remove <span className="font-semibold">{name}</span>? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-60">{loading ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-700">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>
      {children}
    </div>
  );
}

const inputCls = "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
