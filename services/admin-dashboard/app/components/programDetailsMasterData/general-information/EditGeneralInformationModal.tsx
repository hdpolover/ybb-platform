"use client";

import { useEffect, useRef, useState } from "react";
import {
  IdentificationIcon,
  GlobeAltIcon,
  PlayCircleIcon,
  TagIcon,
  PhotoIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { buildApiUrl, getAccessToken, readErrorMessage } from "@/app/components/submissionsMasterData/api";
import { listProgramMedia, type MediaFile } from "@/src/shared/api-client";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { FormSection } from "@/src/ui/drawer/form-section";

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export interface GeneralInformationFormValues {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  videoUrl: string;
  metaTitle: string;
  metaDescription: string;
  isVisibleToUsers: boolean;
}

interface EditGeneralInformationModalProps {
  /** The drawer is always mounted; parent controls visibility with `open`. */
  open?: boolean;
  programId: string;
  brandId: string;
  programName: string;
  initialValues: GeneralInformationFormValues;
  currentLogoUrl?: string | null;
  currentBannerUrl?: string | null;
  currentThumbnailUrl?: string | null;
  onSubmit: (values: GeneralInformationFormValues) => Promise<void>;
  onBrandingUploaded?: () => Promise<void> | void;
  isSaving: boolean;
  errorMessage: string | null;
  onClose: () => void;
}

// ─── Inline Media Picker (used inside ImageUploadField) ───────────────────────

const PICKER_FILTERS = [
  { key: "all", label: "All" },
  { key: "logo", label: "Logos" },
  { key: "banner", label: "Banners" },
  { key: "gallery", label: "Gallery" },
];

function InlineMediaPicker({
  programId,
  brandId,
  onPick,
  onClose,
}: {
  programId: string;
  brandId: string;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    listProgramMedia({
      programId,
      brandId,
      assetType: assetFilter === "all" ? undefined : assetFilter,
      limit: 100,
    })
      .then((result) => {
        setFiles(result.files.filter((f) => f.content_type?.startsWith("image/")));
        setLoading(false);
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : "Failed to load media.");
        setLoading(false);
      });
  }, [programId, brandId, assetFilter]);

  const filtered = search.trim()
    ? files.filter((f) =>
        f.original_filename.toLowerCase().includes(search.toLowerCase()),
      )
    : files;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 px-3 py-2">
        {PICKER_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setAssetFilter(f.key)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
              assetFilter === f.key
                ? "bg-blue-100 text-blue-700"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">
          <MagnifyingGlassIcon className="h-3 w-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-28 bg-transparent text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          title="Close picker"
        >
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Grid */}
      <div className="max-h-80 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <ArrowPathIcon className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : fetchError ? (
          <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700">{fetchError}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-zinc-400">
            <PhotoIcon className="h-8 w-8" />
            <p className="text-xs">No images found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {filtered.map((file) => {
              const url = file.url ?? file.download_url;
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    if (url) onPick(url);
                  }}
                  className="group relative overflow-hidden rounded-md border border-zinc-200 text-left transition hover:border-blue-400 hover:shadow-sm focus:outline-none"
                  title={file.original_filename}
                >
                  <div className="flex h-24 items-center justify-center overflow-hidden bg-zinc-100">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={file.original_filename}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <PhotoIcon className="h-6 w-6 text-zinc-300" />
                    )}
                  </div>
                  <p className="truncate px-1.5 py-1 text-[9px] text-zinc-500" title={file.original_filename}>
                    {file.original_filename}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Image Upload Field ───────────────────────────────────────────────────────

function ImageUploadField({
  label,
  currentUrl,
  file,
  pickedUrl,
  onFileChange,
  onPick,
  onClear,
  uploadStatus,
  hint,
  programId,
  brandId,
}: {
  label: string;
  currentUrl?: string | null;
  file: File | null;
  pickedUrl: string | null;
  onFileChange: (f: File | null) => void;
  onPick: (url: string) => void;
  onClear: () => void;
  uploadStatus: "idle" | "uploading" | "done" | "error";
  hint?: string;
  programId: string;
  brandId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const previewUrl = file ? URL.createObjectURL(file) : pickedUrl ?? currentUrl ?? null;
  const isDirty = file !== null || pickedUrl !== null;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-zinc-500">{label}</label>

      {/* Preview / drop zone — hidden while picker is open */}
      {!pickerOpen && (
        <div
          className="relative flex h-36 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 transition hover:border-blue-300 hover:bg-blue-50/30"
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={label}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-zinc-300">
              <PhotoIcon className="h-8 w-8" />
              <span className="text-[10px]">Click to upload</span>
            </div>
          )}

          {/* Status overlays */}
          {uploadStatus === "uploading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          )}
          {uploadStatus === "done" && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <CheckCircleIcon className="h-7 w-7 text-emerald-500" />
            </div>
          )}

          {/* "From library" badge */}
          {!file && pickedUrl && (
            <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 py-0.5 text-center text-[10px] font-semibold text-white">
              From library
            </div>
          )}

          {/* File name badge */}
          {file && (
            <div className="absolute bottom-0 left-0 right-0 truncate bg-blue-600/90 px-2 py-0.5 text-center text-[10px] font-semibold text-white">
              {file.name}
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onFileChange(f);
          e.target.value = "";
        }}
      />

      {/* Inline library picker */}
      {pickerOpen && (
        <InlineMediaPicker
          programId={programId}
          brandId={brandId}
          onPick={(url) => {
            onPick(url);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-sm transition ${
            pickerOpen
              ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <FolderOpenIcon className="h-3.5 w-3.5" />
          {pickerOpen ? "Close library" : "Pick from library"}
        </button>
        {isDirty && !pickerOpen && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-500 shadow-sm transition hover:bg-rose-50 hover:text-rose-600"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {hint && <p className="text-[10px] leading-relaxed text-zinc-400">{hint}</p>}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function EditGeneralInformationModal({
  open = true,
  programId,
  brandId,
  programName,
  initialValues,
  currentLogoUrl,
  currentBannerUrl,
  currentThumbnailUrl,
  onSubmit,
  onBrandingUploaded,
  isSaving,
  errorMessage,
  onClose,
}: EditGeneralInformationModalProps) {
  const [formValues, setFormValues] = useState<GeneralInformationFormValues>(initialValues);

  // Image file state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  // Library pick state
  const [logoPickedUrl, setLogoPickedUrl] = useState<string | null>(null);
  const [bannerPickedUrl, setBannerPickedUrl] = useState<string | null>(null);
  const [thumbnailPickedUrl, setThumbnailPickedUrl] = useState<string | null>(null);


  // Branding upload state
  const [brandingStatus, setBrandingStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [brandingError, setBrandingError] = useState<string | null>(null);

  const hasBrandingChanges =
    logoFile !== null ||
    bannerFile !== null ||
    thumbnailFile !== null ||
    logoPickedUrl !== null ||
    bannerPickedUrl !== null ||
    thumbnailPickedUrl !== null;
  const hasGeneralChanges =
    formValues.name !== initialValues.name ||
    formValues.slug !== initialValues.slug ||
    formValues.shortDescription !== initialValues.shortDescription ||
    formValues.description !== initialValues.description ||
    formValues.videoUrl !== initialValues.videoUrl ||
    formValues.metaTitle !== initialValues.metaTitle ||
    formValues.metaDescription !== initialValues.metaDescription ||
    formValues.isVisibleToUsers !== initialValues.isVisibleToUsers;
  const isSubmitting = isSaving || brandingStatus === "uploading";
  const drawerError = errorMessage ?? brandingError;

  function resetBrandingState() {
    setBrandingStatus("idle");
    setBrandingError(null);
  }

  function updateField<K extends keyof GeneralInformationFormValues>(
    key: K,
    value: GeneralInformationFormValues[K],
  ) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleUploadBranding(): Promise<boolean> {
    setBrandingStatus("uploading");
    setBrandingError(null);
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Step 1: upload new files via multipart
      const hasFiles = logoFile || bannerFile || thumbnailFile;
      if (hasFiles) {
        const formData = new FormData();
        if (logoFile) formData.append("logo", logoFile);
        if (bannerFile) formData.append("banner", bannerFile);
        if (thumbnailFile) formData.append("thumbnail", thumbnailFile);

        const res = await fetch(
          buildApiUrl(`/programs/${encodeURIComponent(programId)}/branding`),
          { method: "POST", headers, body: formData },
        );
        if (!res.ok) {
          const msg = await readErrorMessage(res);
          throw new Error(msg);
        }
      }

      // Step 2: assign picked URLs via PUT
      const hasUrls = logoPickedUrl || bannerPickedUrl || thumbnailPickedUrl;
      if (hasUrls) {
        const body: Record<string, string> = {};
        if (logoPickedUrl) body.logoUrl = logoPickedUrl;
        if (bannerPickedUrl) body.bannerUrl = bannerPickedUrl;
        if (thumbnailPickedUrl) body.thumbnailUrl = thumbnailPickedUrl;

        const res = await fetch(
          buildApiUrl(`/programs/${encodeURIComponent(programId)}`),
          {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          const msg = await readErrorMessage(res);
          throw new Error(msg);
        }
      }

      setBrandingStatus("done");
      await onBrandingUploaded?.();
      return true;
    } catch (err) {
      setBrandingStatus("error");
      setBrandingError(err instanceof Error ? err.message : "Failed to save images.");
      return false;
    }
  }

  async function handleSubmit() {
    // If there are pending image changes, save those first
    if (hasBrandingChanges && brandingStatus !== "done") {
      const ok = await handleUploadBranding();
      if (!ok) return; // Upload failed — keep modal open with error shown
    }

    if (hasGeneralChanges) {
      await onSubmit(formValues);
      return;
    }

    if (hasBrandingChanges) {
      onClose();
    }
  }

  return (
    <>
      <DrawerShell
        open={open}
        onClose={onClose}
        title="Edit General Information"
        description={
          <>
            Update identity, media, content, and SEO settings for{" "}
            <span className="font-semibold text-zinc-900">{programName}</span>.
          </>
        }
        error={drawerError}
        locked={isSubmitting}
        width="sm:max-w-4xl"
        footer={
          <>
            {brandingStatus === "uploading" ? (
              <span className="mr-auto inline-flex items-center gap-2 text-sm font-medium text-blue-600">
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Uploading images...
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
            >
              {brandingStatus === "uploading"
                ? "Uploading images..."
                : isSaving
                  ? "Saving..."
                  : "Save Changes"}
            </button>
          </>
        }
      >
        <FormSection
          icon={IdentificationIcon}
          title="Program Identity"
          description="Core identifiers that appear across landing pages and marketing materials."
        >
          <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">Program Name</label>
                  <input
                    type="text"
                    value={formValues.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">URL Slug</label>
                  <input
                    type="text"
                    value={formValues.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g. japan-youth-summit-2026"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">Tagline / Short Description</label>
                  <input
                    type="text"
                    value={formValues.shortDescription}
                    onChange={(e) => updateField("shortDescription", e.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="A concise tagline shown on cards and listings"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 flex items-center gap-3 text-xs font-medium text-zinc-500">
                    <input
                      type="checkbox"
                      checked={formValues.isVisibleToUsers}
                      onChange={(e) => updateField("isVisibleToUsers", e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Visible to users on the public site</span>
                  </label>
                </div>
              </div>
        </FormSection>

        <FormSection
          icon={PhotoIcon}
          title="Media Assets"
          description="Logo, banner, and thumbnail images displayed on landing pages."
          actions={
            <>
              {hasBrandingChanges && brandingStatus !== "done" && (
                <button
                  type="button"
                  disabled={brandingStatus === "uploading"}
                  onClick={handleUploadBranding}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  {brandingStatus === "uploading" ? (
                    <>
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Images"
                  )}
                </button>
              )}
              {brandingStatus === "done" && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircleIcon className="h-4 w-4" /> Images saved
                </span>
              )}
            </>
          }
        >
          <div className="grid gap-5 md:grid-cols-3">
            <ImageUploadField
              label="Logo Image"
              currentUrl={currentLogoUrl}
              file={logoFile}
              pickedUrl={logoPickedUrl}
              onFileChange={(f) => { setLogoFile(f); resetBrandingState(); }}
              onPick={(url) => { setLogoPickedUrl(url); setLogoFile(null); resetBrandingState(); }}
              onClear={() => { setLogoFile(null); setLogoPickedUrl(null); resetBrandingState(); }}
              uploadStatus={brandingStatus}
              hint="Square or 4:3 ratio recommended. PNG/JPG up to 2 MB."
              programId={programId}
              brandId={brandId}
            />
            <ImageUploadField
              label="Main Banner Image"
              currentUrl={currentBannerUrl}
              file={bannerFile}
              pickedUrl={bannerPickedUrl}
              onFileChange={(f) => { setBannerFile(f); resetBrandingState(); }}
              onPick={(url) => { setBannerPickedUrl(url); setBannerFile(null); resetBrandingState(); }}
              onClear={() => { setBannerFile(null); setBannerPickedUrl(null); resetBrandingState(); }}
              uploadStatus={brandingStatus}
              hint="16:9 ratio recommended (e.g. 1200×675). PNG/JPG up to 2 MB."
              programId={programId}
              brandId={brandId}
            />
            <ImageUploadField
              label="Thumbnail Image"
              currentUrl={currentThumbnailUrl}
              file={thumbnailFile}
              pickedUrl={thumbnailPickedUrl}
              onFileChange={(f) => { setThumbnailFile(f); resetBrandingState(); }}
              onPick={(url) => { setThumbnailPickedUrl(url); setThumbnailFile(null); resetBrandingState(); }}
              onClear={() => { setThumbnailFile(null); setThumbnailPickedUrl(null); resetBrandingState(); }}
              uploadStatus={brandingStatus}
              hint="Used on program cards and listings. PNG/JPG up to 2 MB."
              programId={programId}
              brandId={brandId}
            />
          </div>
        </FormSection>

        <FormSection
          icon={GlobeAltIcon}
          title="Program Description"
          description="Full description displayed on the program landing page."
        >
          <RichTextEditor
            content={formValues.description}
            onChange={(html) => updateField("description", html)}
            placeholder="Describe the program in detail…"
          />
        </FormSection>

        <FormSection
          icon={PlayCircleIcon}
          title="Promo Video"
          description="YouTube or Vimeo URL shown as the main promotional video."
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Video URL</label>
            <input
              type="url"
              value={formValues.videoUrl}
              onChange={(e) => updateField("videoUrl", e.target.value)}
              className={INPUT_CLS}
              placeholder="https://youtu.be/…"
            />
          </div>
        </FormSection>

        <FormSection
          icon={TagIcon}
          title="SEO & Meta"
          description="Controls how this program appears in search engines."
        >
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Meta Title</label>
              <input
                type="text"
                value={formValues.metaTitle}
                onChange={(e) => updateField("metaTitle", e.target.value)}
                className={INPUT_CLS}
                placeholder="Recommended: 50–60 characters"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Meta Description</label>
              <textarea
                rows={3}
                value={formValues.metaDescription}
                onChange={(e) => updateField("metaDescription", e.target.value)}
                className={INPUT_CLS}
                placeholder="Recommended: 150–160 characters"
              />
            </div>
          </div>
        </FormSection>
      </DrawerShell>
    </>
  );
}
