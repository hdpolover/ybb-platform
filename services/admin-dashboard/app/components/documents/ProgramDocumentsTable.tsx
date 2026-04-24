"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  DocumentTextIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  listDocumentTemplates,
  createDocumentTemplate,
  updateDocumentTemplate,
  deleteDocumentTemplate,
  type DocumentTemplate,
} from "@/src/shared/api-client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { EmptyState } from "@/src/admin/empty-state";

const DOC_TYPES = [
  { value: "agreement_letter", label: "Agreement Letter" },
  { value: "complementary_document", label: "Complementary Document" },
];

const AUDIENCE_TYPES = [
  { value: "all_registered", label: "All Registered Participants" },
  { value: "paid_any", label: "Participants with Any Payment" },
  { value: "paid_pricing_tier", label: "Specific Pricing Tier" },
  { value: "specific_status", label: "Specific Application Status" },
];

const inputCls =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function ProgramDocumentsTable({ programId }: { programId: string }) {
  const { accessiblePrograms, adminProfile } = useAuth();
  const program = accessiblePrograms.find((p) => p.programId === programId);
  const brandId = program?.brandId ?? "";
  const userId = adminProfile?.userId ?? "";

  const [items, setItems] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DocumentTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listDocumentTemplates(programId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteDocumentTemplate(deleteTarget.id);
      toast.success("Document deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <section className="relative rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:text-sm">
      <div className="mb-2.5 flex flex-wrap items-center justify-end gap-2 text-[11px] text-zinc-500">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-600"
            onClick={() => { setEditTarget(null); setSheetOpen(true); }}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Document
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Document Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Audience</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">Loading…</td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10">
                  <EmptyState
                    title="No documents found"
                    description="Add a document to get started."
                  />
                </td>
              </tr>
            )}
            {!loading && items.map((row, index) => (
              <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{index + 1}</td>
                <td className="px-3 py-2 align-top">
                  <div className="font-semibold text-zinc-900">{row.name}</div>
                  {row.description && (
                    <div className="line-clamp-1 text-[11px] text-zinc-500">{row.description}</div>
                  )}
                  {row.templateUrl && (
                    <a
                      href={row.templateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-block text-[10px] text-blue-500 hover:underline"
                    >
                      View file ↗
                    </a>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                    {DOC_TYPES.find((t) => t.value === row.type)?.label ?? row.type}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                    {AUDIENCE_TYPES.find((a) => a.value === row.audienceType)?.label ?? row.audienceType}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  {row.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <CheckCircleIcon className="h-3 w-3" />Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                      <XCircleIcon className="h-3 w-3" />Inactive
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="inline-flex gap-1">
                    {row.templateUrl && (
                      <a
                        href={row.templateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        title="Preview file"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEditTarget(row); setSheetOpen(true); }}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                      title="Edit"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(row)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-red-100 bg-white text-red-400 shadow-sm hover:bg-red-50"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocumentSheet
        open={sheetOpen}
        programId={programId}
        userId={userId}
        brandId={brandId}
        item={editTarget ?? undefined}
        onClose={() => { setSheetOpen(false); setEditTarget(null); }}
        onSaved={load}
      />

      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.name}
          loading={deleteLoading}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </section>
  );
}

// ─── Document Sheet ───────────────────────────────────────────────────────────

function DocumentSheet({
  open, programId, userId, brandId, item, onClose, onSaved,
}: {
  open: boolean;
  programId: string;
  userId: string;
  brandId: string;
  item?: DocumentTemplate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("agreement_letter");
  const [description, setDescription] = useState("");
  const [audienceType, setAudienceType] = useState("all_registered");
  const [pricingTierIds, setPricingTierIds] = useState("");
  const [statuses, setStatuses] = useState("");
  const [order, setOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setType(item?.type ?? "agreement_letter");
      setDescription(item?.description ?? "");
      setAudienceType(item?.audienceType ?? "all_registered");
      const cfg = item?.audienceConfig ?? {};
      setPricingTierIds((Array.isArray(cfg.pricingTierIds) ? cfg.pricingTierIds : []).join(", "));
      setStatuses((Array.isArray(cfg.statuses) ? cfg.statuses : []).join(", "));
      setOrder(String(item?.order ?? 0));
      setIsActive(item?.isActive ?? true);
      setSelectedFile(null);
      setError(null);
    }
  }, [open, item]);

  function buildAudienceConfig(): Record<string, unknown> {
    if (audienceType === "paid_pricing_tier") {
      return {
        pricingTierIds: pricingTierIds.split(",").map((s) => s.trim()).filter(Boolean),
      };
    }
    if (audienceType === "specific_status") {
      return {
        statuses: statuses.split(",").map((s) => s.trim()).filter(Boolean),
      };
    }
    return {};
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !selectedFile) { setError("Select a file to upload."); return; }
    if (!userId || !brandId) { setError("Must be signed in to an accessible program."); return; }
    setLoading(true);
    setError(null);
    try {
      const audienceConfig = buildAudienceConfig();
      if (isEdit && item) {
        await updateDocumentTemplate(item.id, {
          name, type, description: description || undefined,
          audienceType, audienceConfig, order: Number(order), isActive,
          ...(selectedFile ? { file: selectedFile, userId, brandId } : {}),
        });
        toast.success("Document updated.");
      } else {
        await createDocumentTemplate(programId, {
          name, type, description: description || undefined,
          audienceType, audienceConfig, order: Number(order),
          file: selectedFile!, userId, brandId,
        });
        toast.success("Document created.");
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
            <SheetTitle>{isEdit ? "Edit Document" : "Add Program Document"}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? "Update the file or settings for this document."
                : "Configure a new document template for this program."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>
            )}

            {/* File upload */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-zinc-700">
                File {!isEdit ? <span className="text-red-500">*</span> : <span className="ml-1 text-zinc-400">(leave blank to keep existing)</span>}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 transition hover:border-blue-400 hover:bg-blue-50/30"
              >
                <DocumentTextIcon className="h-7 w-7 text-zinc-400" />
                {selectedFile ? (
                  <span className="text-[11px] font-medium text-blue-600">{selectedFile.name}</span>
                ) : (
                  <>
                    <span className="text-[11px] font-medium text-zinc-600">Click to select file</span>
                    <span className="text-[10px] text-zinc-400">PDF, Word · Max 20 MB</span>
                  </>
                )}
              </button>
              {isEdit && item?.templateUrl && !selectedFile && (
                <p className="mt-1 truncate text-[10px] text-zinc-400">
                  Current: {item.templateUrl.split("/").pop()}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Document Name <span className="text-red-500">*</span>
              </label>
              <input required type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard Agreement Letter" className={inputCls} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select required value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Order</label>
                <input type="number" min={0} value={order}
                  onChange={(e) => setOrder(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Description</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of how and when this document is used."
                className={`${inputCls} resize-none`} />
            </div>

            {/* Audience / Visibility */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-[11px] font-semibold text-zinc-700">Visibility (Who can see this?)</p>
              <select value={audienceType} onChange={(e) => setAudienceType(e.target.value)} className={inputCls}>
                {AUDIENCE_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>

              {audienceType === "paid_pricing_tier" && (
                <div className="mt-2">
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                    Pricing Tier IDs (comma-separated)
                  </label>
                  <input type="text" value={pricingTierIds}
                    onChange={(e) => setPricingTierIds(e.target.value)}
                    placeholder="uuid1, uuid2" className={inputCls} />
                  <p className="mt-1 text-[10px] text-zinc-400">
                    Only participants who paid one of these pricing tiers will see this document.
                  </p>
                </div>
              )}

              {audienceType === "specific_status" && (
                <div className="mt-2">
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                    Application Statuses (comma-separated)
                  </label>
                  <input type="text" value={statuses}
                    onChange={(e) => setStatuses(e.target.value)}
                    placeholder="accepted, waitlisted" className={inputCls} />
                </div>
              )}
            </div>

            {isEdit && (
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)} className="h-3.5 w-3.5 rounded" />
                <span className="text-[11px] font-medium text-zinc-700">Active</span>
              </label>
            )}
          </div>

          <SheetFooter className="border-t border-zinc-200 px-6 py-4">
            <button type="button" onClick={onClose} disabled={loading}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60">
              {loading ? (isEdit ? "Saving…" : "Uploading…") : (isEdit ? "Save Changes" : "Save Document")}
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────

function ConfirmDelete({ name, loading, onCancel, onConfirm }: {
  name: string; loading: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete document?</h2>
        <p className="text-[11px] text-zinc-600">
          Remove <span className="font-semibold">"{name}"</span>? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
