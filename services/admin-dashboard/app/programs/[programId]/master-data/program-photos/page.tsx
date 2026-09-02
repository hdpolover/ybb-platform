"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { PlusIcon, TrashIcon, ArrowPathIcon, PencilSquareIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  listProgramGallery,
  createProgramGalleryItem,
  updateProgramGalleryItem,
  deleteProgramGalleryItem,
  type ProgramGalleryItem,
} from "@/src/shared/api-client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import {
  IMAGE_ACCEPT_ATTR,
  IMAGE_HINT,
  validateUploadType,
} from "@/lib/upload-validation";
import { MediaLibraryPicker } from "@/app/components/submissionsMasterData/form-fields/MediaLibraryPicker";
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";

export default function ProgramPhotosPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms, adminProfile } = useAuth();
  const resolvedProgramId = useResolvedProgramId(params.programId);
  const program = accessiblePrograms.find((p) => p.programId === params.programId);
  const brandId = program?.brandId ?? "";
  const userId = adminProfile?.userId ?? "";
  const [items, setItems] = useState<ProgramGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramGalleryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramGalleryItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
  const [copyFromTemplateOpen, setCopyFromTemplateOpen] = useState(false);

  const programName = accessiblePrograms.find((p) => p.programId === params.programId)?.programName ?? "Selected Program";

  const fetchItems = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true); setError(null);
    try { setItems(await listProgramGallery(resolvedProgramId)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [resolvedProgramId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try { await deleteProgramGalleryItem(deleteTarget.id); setDeleteTarget(null); fetchItems(); }
    catch (err) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleteLoading(false); }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Master Data</div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Photos</h1>
        <p className="text-sm text-zinc-500">Manage the photo gallery for this program.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">{items.length} photo(s)</p>
          <div className="flex gap-2">
            <button type="button" onClick={fetchItems} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
              <ArrowPathIcon className="h-3.5 w-3.5" />Refresh
            </button>
            <button
              type="button"
              onClick={() => setCopyFromProgramOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from program</span>
            </button>
            <button
              type="button"
              onClick={() => setCopyFromTemplateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from template</span>
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600">
              <PlusIcon className="h-3.5 w-3.5" />Upload Photo
            </button>
          </div>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {loading && <p className="text-xs text-zinc-400">Loading…</p>}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <PhotoIcon className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-zinc-700">No photos yet</p>
            <p className="mt-1 text-[11px] text-zinc-500">Upload the first photo for this program.</p>
            <button type="button" onClick={() => setShowCreate(true)} className="mt-4 inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600">
              <PlusIcon className="h-3.5 w-3.5" />Upload Photo
            </button>
          </div>
        )}
        {!loading && items.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item) => (
              <div key={item.id} className="group relative flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="relative h-32 w-full overflow-hidden bg-zinc-100">
                  <img src={item.imageUrl} alt={item.title ?? ""} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  {/* Action overlay */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setEditTarget(item)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-zinc-700 shadow transition hover:bg-white"
                      title="Edit photo"
                    >
                      <PencilSquareIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500 text-white shadow transition hover:bg-red-600"
                      title="Delete photo"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {(item.title || item.year) && (
                  <div className="px-2.5 py-2">
                    {item.title && <p className="truncate text-[11px] font-medium text-zinc-800">{item.title}</p>}
                    {item.year && <p className="text-[10px] text-zinc-400">{item.year}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <PhotoModal
          programId={resolvedProgramId}
          userId={userId}
          brandId={brandId}
          onClose={() => setShowCreate(false)}
          onSaved={fetchItems}
        />
      )}
      {editTarget && (
        <PhotoModal
          programId={resolvedProgramId}
          userId={userId}
          brandId={brandId}
          item={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={fetchItems}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete name={deleteTarget.title ?? "this photo"} loading={deleteLoading} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}

      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="photos"
        entityLabel="Photos"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
          fetchItems();
        }}
      />

      <CopyFromTemplateDialog
        open={copyFromTemplateOpen}
        entityKey="photos"
        entityLabel="Photos"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromTemplateOpen(false)}
        onApplied={() => {
          setCopyFromTemplateOpen(false);
          fetchItems();
        }}
      />
    </main>
  );
}

// ─── Photo Modal (Create & Edit) ─────────────────────────────────────────────

function PhotoModal({
  programId,
  userId,
  brandId,
  item,
  onClose,
  onSaved,
}: {
  programId: string;
  userId: string;
  brandId: string;
  item?: ProgramGalleryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [year, setYear] = useState(item?.year ? String(item.year) : "");
  const [order, setOrder] = useState(item?.order !== undefined ? String(item.order) : "0");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(item?.imageUrl ?? null);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Refuse an unsupported type here, naming the file, instead of letting the
    // upload fail against the file service after the admin has filled the form.
    // Size is checked at upload time, once client-side compression has run.
    const rejection = validateUploadType(file, { imagesOnly: true });
    if (rejection) {
      setError(rejection);
      e.target.value = "";
      return;
    }
    setError(null);
    setImageFile(file);
    setSelectedMediaUrl(null);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !imageFile && !selectedMediaUrl) {
      setError("Please upload an image or pick one from the media library.");
      return;
    }
    if (imageFile && (!userId || !brandId)) {
      setError("You must be signed in to an accessible program.");
      return;
    }
    setLoading(true); setError(null);
    try {
      if (isEdit && item) {
        await updateProgramGalleryItem(item.id, {
          title: title || undefined,
          description: description || undefined,
          year: year ? Number(year) : undefined,
          order: order !== "" ? Number(order) : undefined,
          ...(selectedMediaUrl ? { imageUrl: selectedMediaUrl } : {}),
          ...(imageFile ? { image: imageFile, userId, brandId, programId } : {}),
        });
      } else {
        await createProgramGalleryItem(programId, {
          title: title || undefined,
          description: description || undefined,
          year: year ? Number(year) : undefined,
          order: order !== "" ? Number(order) : undefined,
          ...(selectedMediaUrl ? { imageUrl: selectedMediaUrl } : {}),
          ...(imageFile ? { image: imageFile, userId, brandId } : {}),
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
    <Sheet open onOpenChange={(open) => !open && !loading && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-5 py-4 pr-12">
          <SheetTitle className="text-sm font-bold text-zinc-900">{isEdit ? "Edit Photo" : "Upload Photo"}</SheetTitle>
          <SheetDescription className="text-[11px] text-zinc-500">
            {isEdit ? "Update the image or metadata for this photo." : "Upload a new highlight photo for this program."}
          </SheetDescription>
        </SheetHeader>

        <form id="program-photo-form" onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>}

          {/* Image upload area */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-zinc-700">
              Image {!isEdit && <span className="text-red-500">*</span>}
              {isEdit && <span className="ml-1 text-zinc-400">(leave blank to keep existing)</span>}
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-40 w-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 transition hover:border-blue-400 hover:bg-blue-50/30"
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/30">
                    <span className="hidden rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 group-hover:block hover:bg-white">Change image</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-400">
                  <PhotoIcon className="h-8 w-8" />
                  <span className="text-[11px] font-medium">Click to select image</span>
                  <span className="text-[10px] text-zinc-400">{IMAGE_HINT}</span>
                </div>
              )}
            </button>
            {imageFile && (
              <p className="mt-1 truncate text-[10px] text-zinc-500">{imageFile.name}</p>
            )}
            {selectedMediaUrl && !imageFile && (
              <p className="mt-1 truncate text-[10px] text-zinc-500">Selected from media library</p>
            )}
            <input ref={fileInputRef} type="file" accept={IMAGE_ACCEPT_ATTR} className="hidden" onChange={handleFileChange} />
            <button
              type="button"
              onClick={() => {
                if (!brandId) {
                  setError("You must be signed in to an accessible program.");
                  return;
                }
                setIsMediaPickerOpen(true);
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Pick from Media Library
            </button>
          </div>

          {/* Text fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Opening Ceremony" className={inputCls} />
            </Field>
            <Field label="Year">
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder={String(new Date().getFullYear())} min="2000" max="2100" className={inputCls} />
            </Field>
          </div>

          <Field label="Description">
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short caption or description (optional)" className={`${inputCls} resize-none`} />
          </Field>

          <Field label="Display Order">
            <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} min="0" className={inputCls} />
          </Field>
        </form>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="program-photo-form"
            disabled={loading}
            className="rounded-md bg-blue-500 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {loading ? (isEdit ? "Saving…" : "Uploading…") : (isEdit ? "Save Changes" : "Upload")}
          </button>
        </div>
      </SheetContent>
      <MediaLibraryPicker
        open={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        programId={programId}
        brandId={brandId}
        defaultAssetType="gallery"
        onPick={(file) => {
          if (!file.url) {
            setError("Selected media does not have a usable URL.");
            return;
          }
          setError(null);
          setImageFile(null);
          setSelectedMediaUrl(file.url);
          setImagePreview(file.url);
        }}
      />
    </Sheet>
  );
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────

function ConfirmDelete({ name, loading, onCancel, onConfirm }: { name: string; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete photo?</h2>
        <p className="text-[11px] text-zinc-600">Remove <span className="font-semibold">{name}</span>? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">{loading ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-700">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>
      {children}
    </div>
  );
}

const inputCls = "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
