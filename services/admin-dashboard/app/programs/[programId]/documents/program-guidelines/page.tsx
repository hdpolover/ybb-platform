"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  listProgramResources,
  createProgramResource,
  updateProgramResource,
  deleteProgramResource,
  type ProgramResource,
} from "@/src/shared/api-client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/src/ui/sheet";

const RESOURCE_TYPES: { value: string; label: string }[] = [
  { value: "guide", label: "Guide" },
  { value: "brochure", label: "Brochure" },
  { value: "handbook", label: "Handbook" },
  { value: "presentation", label: "Presentation" },
  { value: "media_kit", label: "Media Kit" },
];

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProgramGuidelinesPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms, adminProfile } = useAuth();
  const program = accessiblePrograms.find((p) => p.programId === params.programId);
  const brandId = program?.brandId ?? "";
  const userId = adminProfile?.userId ?? "";
  const programName = program?.programName ?? "Selected Program";

  const [items, setItems] = useState<ProgramResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramResource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramResource | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listProgramResources(params.programId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [params.programId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteProgramResource(deleteTarget.id);
      toast.success("Guideline deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Master Data
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Guidelines</h1>
        <p className="text-sm text-zinc-500">
          Manage program guidelines and documents. These appear on the landing page and participant
          dashboard.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">{items.length} guideline(s)</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Upload Guideline
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <DocumentTextIcon className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-zinc-700">No guidelines yet</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Upload the first guideline document for this program.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Upload Guideline
            </button>
          </div>
        )}

        {(loading || items.length > 0) && (
          <div className="overflow-hidden rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-[11px]">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="w-8 px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">File</th>
                  <th className="px-3 py-2 font-semibold">Visibility</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-zinc-400">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                      <td className="px-3 py-2 text-zinc-400">{item.order}</td>
                      <td className="px-3 py-2">
                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-zinc-900 hover:text-blue-600 hover:underline"
                        >
                          {item.title}
                        </a>
                        {item.description && (
                          <p className="mt-0.5 line-clamp-1 text-zinc-500">{item.description}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                          {RESOURCE_TYPES.find((t) => t.value === item.type)?.label ?? item.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        <div>{item.fileType?.split("/")[1]?.toUpperCase() ?? "—"}</div>
                        <div className="text-[10px] text-zinc-400">{formatBytes(item.fileSize)}</div>
                      </td>
                      <td className="px-3 py-2">
                        {item.isPublic ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                            <EyeIcon className="h-3 w-3" />
                            Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                            <EyeSlashIcon className="h-3 w-3" />
                            Private
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {item.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <CheckCircleIcon className="h-3 w-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                            <XCircleIcon className="h-3 w-3" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{item.downloads}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditTarget(item)}
                            className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"
                            title="Delete"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ResourceSheet
        open={showCreate || editTarget !== null}
        programId={params.programId}
        userId={userId}
        brandId={brandId}
        item={editTarget ?? undefined}
        onClose={() => {
          setShowCreate(false);
          setEditTarget(null);
        }}
        onSaved={load}
      />

      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.title}
          loading={deleteLoading}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </main>
  );
}

// ─── Resource Sheet (Create & Edit) ──────────────────────────────────────────

function ResourceSheet({
  open,
  programId,
  userId,
  brandId,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  programId: string;
  userId: string;
  brandId: string;
  item?: ProgramResource;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("guide");
  const [isPublic, setIsPublic] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [order, setOrder] = useState("0");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(item?.title ?? "");
      setDescription(item?.description ?? "");
      setType(item?.type ?? "guide");
      setIsPublic(item?.isPublic ?? true);
      setIsActive(item?.isActive ?? true);
      setOrder(String(item?.order ?? 0));
      setSelectedFile(null);
      setError(null);
    }
  }, [open, item]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !selectedFile) {
      setError("Select a file to upload.");
      return;
    }
    if (!userId || !brandId) {
      setError("You must be signed in to an accessible program.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isEdit && item) {
        await updateProgramResource(item.id, {
          title,
          description: description || undefined,
          type,
          isPublic,
          isActive,
          order: Number(order),
          ...(selectedFile ? { file: selectedFile, userId, brandId } : {}),
        });
        toast.success("Guideline updated.");
      } else {
        await createProgramResource(programId, {
          title,
          description: description || undefined,
          type,
          isPublic,
          order: Number(order),
          file: selectedFile!,
          userId,
          brandId,
        });
        toast.success("Guideline uploaded.");
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v && !loading) onClose(); }}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col p-0 sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-zinc-200 px-6 py-5">
            <SheetTitle>{isEdit ? "Edit Guideline" : "Upload Guideline"}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? "Update the file or details for this guideline."
                : "Upload a new program guideline document."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>
            )}

            {/* File upload */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-zinc-700">
                File{" "}
                {!isEdit ? (
                  <span className="text-red-500">*</span>
                ) : (
                  <span className="ml-1 text-zinc-400">(leave blank to keep existing)</span>
                )}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 transition hover:border-blue-400 hover:bg-blue-50/30"
              >
                <DocumentTextIcon className="h-8 w-8 text-zinc-400" />
                {selectedFile ? (
                  <span className="text-[11px] font-medium text-blue-600">{selectedFile.name}</span>
                ) : (
                  <>
                    <span className="text-[11px] font-medium text-zinc-600">
                      Click to select file
                    </span>
                    <span className="text-[10px] text-zinc-400">PDF, Word, PowerPoint · Max 20 MB</span>
                  </>
                )}
              </button>
              {isEdit && item && !selectedFile && (
                <p className="mt-1 truncate text-[10px] text-zinc-400">
                  Current: {item.fileUrl.split("/").pop()}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <Field label="Title" required>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Panduan Pendaftaran / Registration Guide"
                className={inputCls}
              />
            </Field>

            <Field label="Description">
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description (optional)"
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" required>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={inputCls}
                >
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Display Order">
                <input
                  type="number"
                  min={0}
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-3.5 w-3.5 rounded"
                />
                <span className="text-[11px] font-medium text-zinc-700">
                  Public{" "}
                  <span className="font-normal text-zinc-400">
                    (visible before login on landing page)
                  </span>
                </span>
              </label>
              {isEdit && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="text-[11px] font-medium text-zinc-700">Active</span>
                </label>
              )}
            </div>
          </div>

          <SheetFooter className="border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
            >
              {loading
                ? isEdit
                  ? "Saving…"
                  : "Uploading…"
                : isEdit
                  ? "Save Changes"
                  : "Upload"}
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────

function ConfirmDelete({
  name,
  loading,
  onCancel,
  onConfirm,
}: {
  name: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete guideline?</h2>
        <p className="text-[11px] text-zinc-600">
          Remove <span className="font-semibold">"{name}"</span>? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
