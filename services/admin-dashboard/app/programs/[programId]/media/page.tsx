"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  ArrowPathIcon,
  CloudArrowUpIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  TrashIcon,
  DocumentIcon,
  PhotoIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  listProgramMedia,
  deleteProgramMediaFile,
  uploadFileViaPresignedUrl,
  type MediaFile,
} from "@/src/shared/api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/src/ui/sheet";
import { formatDate, formatDateTime } from "@/lib/utils";

const ASSET_TYPE_LABELS: Record<string, string> = {
  all: "All",
  image: "Images",
  document: "Documents",
  logo: "Logos",
  banner: "Banners",
  gallery: "Gallery",
  certificate: "Certificates",
  other: "Other",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(file: MediaFile): boolean {
  return file.content_type?.startsWith("image/") ?? false;
}

function getFileUrl(file: MediaFile): string | null {
  return file.url ?? file.download_url ?? null;
}

// ─── Media Grid Card ──────────────────────────────────────────────────────────

function MediaCard({
  file,
  selected,
  onSelect,
  onDelete,
}: {
  file: MediaFile;
  selected: boolean;
  onSelect: (file: MediaFile) => void;
  onDelete: (file: MediaFile) => void;
}) {
  const url = getFileUrl(file);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(file)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(file)}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
        selected
          ? "border-blue-400 ring-2 ring-blue-100"
          : "border-zinc-200 hover:border-blue-300 hover:shadow-md"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-zinc-100">
        {isImage(file) && url ? (
          <img
            src={url}
            alt={file.original_filename}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <DocumentIcon className="h-10 w-10 text-zinc-400" />
        )}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-600/20">
            <CheckCircleIcon className="h-8 w-8 text-blue-600" />
          </div>
        )}
        <button
          type="button"
          className="absolute right-1.5 top-1.5 hidden rounded-md bg-red-50 p-1 text-red-600 shadow transition hover:bg-red-100 group-hover:flex"
          onClick={(e) => { e.stopPropagation(); onDelete(file); }}
          aria-label={`Delete ${file.original_filename}`}
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        <p className="truncate text-[11px] font-semibold text-zinc-900" title={file.original_filename}>
          {file.original_filename}
        </p>
        <p className="text-[10px] text-zinc-400">
          {formatBytes(file.size)} · {file.asset_type ?? file.bucket}
        </p>
      </div>
    </div>
  );
}

// ─── Media Detail Panel ───────────────────────────────────────────────────────

function MediaDetailPanel({
  file,
  onClose,
  onDelete,
}: {
  file: MediaFile;
  onClose: () => void;
  onDelete: (file: MediaFile) => void;
}) {
  const url = getFileUrl(file);
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">File Details</h3>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          onClick={onClose}
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Preview */}
        <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50">
          {isImage(file) && url ? (
            <img src={url} alt={file.original_filename} className="max-h-full max-w-full object-contain" />
          ) : (
            <DocumentIcon className="h-12 w-12 text-zinc-300" />
          )}
        </div>

        {/* Meta */}
        <dl className="space-y-2 text-[11px]">
          {[
            { label: "Filename", value: file.original_filename },
            { label: "Title", value: file.title ?? "—" },
            { label: "Alt Text", value: file.alt_text ?? "—" },
            { label: "Type", value: file.content_type },
            { label: "Size", value: formatBytes(file.size) },
            ...(file.width && file.height ? [{ label: "Dimensions", value: `${file.width} × ${file.height}` }] : []),
            { label: "Asset Type", value: file.asset_type ?? "—" },
            { label: "Bucket", value: file.bucket },
            { label: "Status", value: file.status },
            { label: "Uploaded", value: formatDateTime(file.uploaded_at) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-2">
              <dt className="font-medium text-zinc-500">{label}</dt>
              <dd className="truncate text-zinc-900 max-w-[160px]" title={value}>{value}</dd>
            </div>
          ))}
        </dl>

        {/* Actions */}
        <div className="space-y-2">
          {url && (
            <>
              <button
                type="button"
                onClick={copyUrl}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 px-3 py-2 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy URL"}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 px-3 py-2 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                Open File
              </a>
            </>
          )}
          <button
            type="button"
            onClick={() => onDelete(file)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700 hover:bg-red-100"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Delete File
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Sheet ─────────────────────────────────────────────────────────────

function UploadSheet({
  open,
  programId,
  brandId,
  userId,
  onUploaded,
  onClose,
}: {
  open: boolean;
  programId: string;
  brandId: string;
  userId: string;
  onUploaded: () => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [assetType, setAssetType] = useState("gallery");
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setFiles([]);
      setPreviews([]);
      setAssetType("gallery");
      setTitle("");
      setAltText("");
    }
  }, [open]);

  // Generate object-URL previews for image files
  function applyFiles(newFiles: File[]) {
    // Revoke previous previews to avoid memory leaks
    previews.forEach((p) => URL.revokeObjectURL(p));
    const urls = newFiles.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
    );
    setFiles(newFiles);
    setPreviews(urls);
  }

  // Revoke on unmount
  useEffect(() => () => { previews.forEach((p) => { if (p) URL.revokeObjectURL(p); }); }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    applyFiles(Array.from(e.dataTransfer.files));
  }

  async function handleUpload() {
    if (!files.length) return;
    setUploading(true);
    const hasImages = files.some((f) => f.type.startsWith("image/"));
    const toastId = toast.loading(
      hasImages
        ? files.length === 1
          ? `Processing & uploading "${files[0].name}"…`
          : `Processing & uploading ${files.length} files…`
        : files.length === 1
          ? `Uploading "${files[0].name}"…`
          : `Uploading ${files.length} files…`,
    );
    onClose();
    const settled = await Promise.allSettled(
      files.map((file) =>
        uploadFileViaPresignedUrl(file, {
          userId,
          brandId,
          bucket: assetType,
          programId,
          assetType,
          title: title.trim() || undefined,
          altText: altText.trim() || undefined,
        }),
      ),
    );
    const succeeded = settled.filter((r) => r.status === "fulfilled").length;
    const failed = settled.filter((r) => r.status === "rejected");
    if (failed.length === 0) {
      toast.success(
        succeeded === 1 ? `"${files[0].name}" uploaded.` : `${succeeded} files uploaded.`,
        { id: toastId },
      );
      onUploaded();
    } else if (succeeded > 0) {
      toast.warning(
        `${succeeded} uploaded, ${failed.length} failed: ${(failed[0].reason as Error)?.message ?? "unknown error"}.`,
        { id: toastId },
      );
      onUploaded();
    } else {
      toast.error(
        `Upload failed: ${(failed[0].reason as Error)?.message ?? "unknown error"}.`,
        { id: toastId },
      );
    }
    setUploading(false);
  }

  const multiFile = files.length > 1;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b border-zinc-200 px-6 py-5">
          <SheetTitle>Upload Media</SheetTitle>
          <SheetDescription>
            Upload images or documents to the program media library.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 px-6 py-5">
          {/* Drop Zone */}
          <div
            className={`relative flex min-h-[130px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-center transition ${
              files.length > 0
                ? "border-blue-400 bg-blue-50/20"
                : "border-zinc-300 bg-zinc-50 hover:border-blue-400 hover:bg-blue-50/30"
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          >
            {/* Single image preview */}
            {files.length === 1 && previews[0] ? (
              <>
                <img
                  src={previews[0]}
                  alt={files[0].name}
                  className="max-h-48 max-w-full rounded object-contain p-2"
                />
                <p className="mt-1 px-3 pb-2 text-[11px] font-medium text-blue-600 truncate max-w-full">
                  {files[0].name}
                </p>
              </>
            ) : files.length === 1 ? (
              /* Single non-image */
              <div className="flex flex-col items-center gap-1.5 p-6">
                <DocumentIcon className="h-10 w-10 text-zinc-400" />
                <p className="text-xs font-semibold text-blue-600">{files[0].name}</p>
              </div>
            ) : files.length > 1 ? (
              /* Multi-file grid preview */
              <div className="flex flex-col items-center gap-2 p-4">
                <div className="flex flex-wrap justify-center gap-1.5">
                  {previews.slice(0, 6).map((src, i) =>
                    src ? (
                      <img
                        key={i}
                        src={src}
                        alt={files[i].name}
                        className="h-14 w-14 rounded object-cover border border-zinc-200"
                      />
                    ) : (
                      <div key={i} className="flex h-14 w-14 items-center justify-center rounded border border-zinc-200 bg-zinc-100">
                        <DocumentIcon className="h-6 w-6 text-zinc-400" />
                      </div>
                    ),
                  )}
                  {files.length > 6 && (
                    <div className="flex h-14 w-14 items-center justify-center rounded border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-500">
                      +{files.length - 6}
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold text-blue-600">{files.length} files selected</p>
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center gap-1 p-6">
                <CloudArrowUpIcon className="h-8 w-8 text-zinc-400" />
                <p className="text-xs font-semibold text-zinc-700">Drag & drop or click to select</p>
                <p className="text-[11px] text-zinc-400">Images up to 5 MB, documents up to 10 MB</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => applyFiles(Array.from(e.target.files ?? []))}
            />
          </div>

          {/* Asset Type */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Asset Type</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {Object.entries(ASSET_TYPE_LABELS).filter(([k]) => k !== "all").map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">
              Title
              <span className="ml-1 text-[10px] font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={multiFile ? "Applies to all uploaded files" : "e.g. Program Banner 2026"}
              maxLength={255}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Alt Text */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">
              Alt Text
              <span className="ml-1 text-[10px] font-normal text-zinc-400">(images only, optional)</span>
            </label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder={multiFile ? "Applies to all uploaded files" : "Describe the image for accessibility"}
              maxLength={500}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <SheetFooter className="border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {files.length > 0 ? `Upload (${files.length})` : "Upload"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({
  file,
  onConfirm,
  onCancel,
  loading,
}: {
  file: MediaFile;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl">
        <h2 className="text-sm font-bold text-zinc-900">Delete File?</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          <span className="font-semibold text-zinc-800">{file.original_filename}</span> will be permanently removed from storage and cannot be recovered.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MediaLibraryPage() {
  const params = useParams<{ programId: string }>();
  const resolvedProgramId = useResolvedProgramId(params.programId);
  const { accessiblePrograms, adminProfile } = useAuth();

  const program = accessiblePrograms.find(
    (p) => p.programId === params.programId || p.programSlug === params.programId,
  );
  const programName = program?.programName ?? "Selected Program";
  const brandId = program?.brandId ?? "";
  const userId = adminProfile?.userId ?? "";

  // State
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetTypeFilter, setAssetTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const limit = 48;

  const fetchMedia = useCallback(async () => {
    if (!resolvedProgramId || !brandId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listProgramMedia({
        programId: resolvedProgramId,
        brandId,
        assetType: assetTypeFilter === "all" ? undefined : assetTypeFilter,
        page,
        limit,
      });
      setFiles(res.files ?? []);
      setTotal(res.total ?? 0);
      setTotalPages(res.total_pages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media.");
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId, brandId, assetTypeFilter, page]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  async function handleDelete() {
    if (!deleteTarget || !brandId) return;
    setDeleteLoading(true);
    try {
      await deleteProgramMediaFile({ programId: resolvedProgramId, fileId: deleteTarget.id, brandId });
      setDeleteTarget(null);
      if (selectedFile?.id === deleteTarget.id) setSelectedFile(null);
      fetchMedia();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleteLoading(false);
    }
  }

  // Client-side search filter
  const displayed = (files ?? []).filter((f) =>
    !search.trim() || f.original_filename.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <main className="flex h-full flex-col space-y-4">
      {/* Header */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Media
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">Media Library</h1>
        <p className="text-sm text-zinc-500">
          All images and files uploaded for <span className="font-semibold text-zinc-700">{programName}</span>. Upload, browse, and manage assets from one place.
        </p>
      </section>

      {/* Toolbar */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Asset type tabs */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setAssetTypeFilter(value); setPage(1); }}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  assetTypeFilter === value
                    ? "bg-blue-500 text-white"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search files…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-md border border-zinc-200 bg-white pl-8 pr-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* View toggle */}
            <div className="flex rounded-md border border-zinc-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 transition ${viewMode === "grid" ? "bg-blue-50 text-blue-600" : "text-zinc-500 hover:bg-zinc-50"}`}
                aria-label="Grid view"
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1.5 transition ${viewMode === "list" ? "bg-blue-50 text-blue-600" : "text-zinc-500 hover:bg-zinc-50"}`}
                aria-label="List view"
              >
                <ListBulletIcon className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={fetchMedia}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
            >
              <CloudArrowUpIcon className="h-3.5 w-3.5" />
              Upload
            </button>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-zinc-400">{total} file(s) · Page {page} of {totalPages}</p>
      </section>

      {/* Content */}
      <div className="flex min-h-0 flex-1 gap-4">
        <section className="flex-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm overflow-auto">
          {error && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <PhotoIcon className="mb-2 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-semibold text-zinc-500">No media found</p>
              <p className="text-xs text-zinc-400">
                {search ? "Try a different search term." : "Upload your first file using the Upload button."}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {displayed.map((file) => (
                <MediaCard
                  key={file.id}
                  file={file}
                  selected={selectedFile?.id === file.id}
                  onSelect={setSelectedFile}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-zinc-200">
              <table className="min-w-full text-left text-[11px]">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Size</th>
                    <th className="px-3 py-2 font-semibold">Asset Type</th>
                    <th className="px-3 py-2 font-semibold">Uploaded</th>
                    <th className="px-3 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((file) => (
                    <tr
                      key={file.id}
                      className={`cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 ${selectedFile?.id === file.id ? "bg-blue-50" : ""}`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <td className="flex items-center gap-2 px-3 py-2">
                        {isImage(file) ? (
                          <PhotoIcon className="h-4 w-4 shrink-0 text-blue-400" />
                        ) : (
                          <DocumentIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                        )}
                        <span className="max-w-[200px] truncate font-medium text-zinc-900" title={file.original_filename}>
                          {file.original_filename}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">{file.content_type}</td>
                      <td className="px-3 py-2 text-zinc-500">{formatBytes(file.size)}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                          {file.asset_type ?? file.bucket}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{formatDate(file.uploaded_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(file); }}
                          className="rounded-md border border-red-100 bg-red-50 p-1 text-red-600 hover:bg-red-100"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[11px] text-zinc-500">Page {page} of {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </section>

        {/* Detail Panel */}
        {selectedFile && (
          <MediaDetailPanel
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            onDelete={setDeleteTarget}
          />
        )}
      </div>

      {/* Upload Sheet */}
      <UploadSheet
        open={showUpload}
        programId={resolvedProgramId}
        brandId={brandId}
        userId={userId}
        onUploaded={() => { setShowUpload(false); fetchMedia(); }}
        onClose={() => setShowUpload(false)}
      />

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <DeleteModal
          file={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </main>
  );
}
