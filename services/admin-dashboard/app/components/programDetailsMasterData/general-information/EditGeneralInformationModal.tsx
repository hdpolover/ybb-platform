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
  onBrandingUploaded?: () => void;
  isSaving: boolean;
  errorMessage: string | null;
  onClose: () => void;
}

// ─── Media Picker Modal ───────────────────────────────────────────────────────

const PICKER_FILTERS = [
  { key: "all", label: "All Images" },
  { key: "logo", label: "Logos" },
  { key: "banner", label: "Banners" },
  { key: "gallery", label: "Gallery" },
];

function MediaPickerModal({
  programId,
  brandId,
  onSelect,
  onClose,
}: {
  programId: string;
  brandId: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaFile | null>(null);
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

  function handleConfirm() {
    if (!selected) return;
    const url = selected.url ?? selected.download_url;
    if (!url) return;
    onSelect(url);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h3 className="text-base font-bold text-zinc-900">Pick from Media Library</h3>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Filters + Search */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-5 py-3">
          {PICKER_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => { setAssetFilter(f.key); setSelected(null); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                assetFilter === f.key
                  ? "bg-blue-100 text-blue-700"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5">
            <MagnifyingGlassIcon className="h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search files\u2026"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : fetchError ? (
            <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{fetchError}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-zinc-400">
              <PhotoIcon className="h-10 w-10" />
              <p className="text-sm">No images found in this program\u2019s media library.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {filtered.map((file) => {
                const url = file.url ?? file.download_url;
                const isSelected = selected?.id === file.id;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelected(isSelected ? null : file)}
                    className={`relative overflow-hidden rounded-lg border-2 text-left transition focus:outline-none ${
                      isSelected
                        ? "border-blue-500 ring-2 ring-blue-100"
                        : "border-zinc-200 hover:border-blue-300 hover:shadow-sm"
                    }`}
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
                        <PhotoIcon className="h-8 w-8 text-zinc-300" />
                      )}
                    </div>
                    <p
                      className="truncate px-2 py-1.5 text-[10px] text-zinc-600"
                      title={file.original_filename}
                    >
                      {file.original_filename}
                    </p>
                    {isSelected && (
                      <div className="absolute right-1.5 top-1.5">
                        <CheckCircleIcon className="h-5 w-5 text-blue-600 drop-shadow" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-4">
          <p className="text-xs text-zinc-400">
            {selected ? (
              <span className="text-blue-600">1 image selected</span>
            ) : (
              "Click an image to select it"
            )}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={handleConfirm}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Use this image
            </button>
          </div>
        </div>
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
  onPickFromLibrary,
  onClear,
  uploadStatus,
  hint,
}: {
  label: string;
  currentUrl?: string | null;
  file: File | null;
  pickedUrl: string | null;
  onFileChange: (f: File | null) => void;
  onPickFromLibrary: () => void;
  onClear: () => void;
  uploadStatus: "idle" | "uploading" | "done" | "error";
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = file ? URL.createObjectURL(file) : pickedUrl ?? currentUrl ?? null;
  const isDirty = file !== null || pickedUrl !== null;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-zinc-500">{label}</label>

      {/* Preview / drop zone */}
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

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPickFromLibrary}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        >
          <FolderOpenIcon className="h-3.5 w-3.5 text-zinc-500" />
          Pick from library
        </button>
        {isDirty && (
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

  // Picker modal target
  const [pickerTarget, setPickerTarget] = useState<"logo" | "banner" | "thumbnail" | null>(null);

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
      onBrandingUploaded?.();
      return true;
    } catch (err) {
      setBrandingStatus("error");
      setBrandingError(err instanceof Error ? err.message : "Failed to save images.");
      return false;
    }
  }

  function handlePickerSelect(url: string) {
    if (pickerTarget === "logo") {
      setLogoPickedUrl(url);
      setLogoFile(null);
    } else if (pickerTarget === "banner") {
      setBannerPickedUrl(url);
      setBannerFile(null);
    } else if (pickerTarget === "thumbnail") {
      setThumbnailPickedUrl(url);
      setThumbnailFile(null);
    }
    setBrandingStatus("idle");
    setPickerTarget(null);
  }

  async function handleSubmit() {
    // If there are pending image changes, save those first
    if (hasBrandingChanges && brandingStatus !== "done") {
      const ok = await handleUploadBranding();
      if (!ok) return; // Upload failed — keep modal open with error shown
    }
    await onSubmit(formValues);
  }

  return (
    <>
      {/* Nested media picker — renders above the drawer (z-[60] in its own overlay). */}
      {pickerTarget && (
        <MediaPickerModal
          programId={programId}
          brandId={brandId}
          onSelect={handlePickerSelect}
          onClose={() => setPickerTarget(null)}
        />
      )}

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
        error={errorMessage}
        locked={isSaving || brandingStatus === "uploading"}
        width="sm:max-w-4xl"
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
              onClick={handleSubmit}
              disabled={isSaving}
              className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save Changes"}
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
          {brandingError && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {brandingError}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-3">
            <ImageUploadField
              label="Logo Image"
              currentUrl={currentLogoUrl}
              file={logoFile}
              pickedUrl={logoPickedUrl}
              onFileChange={(f) => { setLogoFile(f); setBrandingStatus("idle"); }}
              onPickFromLibrary={() => setPickerTarget("logo")}
              onClear={() => { setLogoFile(null); setLogoPickedUrl(null); setBrandingStatus("idle"); }}
              uploadStatus={brandingStatus}
              hint="Square or 4:3 ratio recommended. PNG/JPG up to 2 MB."
            />
            <ImageUploadField
              label="Main Banner Image"
              currentUrl={currentBannerUrl}
              file={bannerFile}
              pickedUrl={bannerPickedUrl}
              onFileChange={(f) => { setBannerFile(f); setBrandingStatus("idle"); }}
              onPickFromLibrary={() => setPickerTarget("banner")}
              onClear={() => { setBannerFile(null); setBannerPickedUrl(null); setBrandingStatus("idle"); }}
              uploadStatus={brandingStatus}
              hint="16:9 ratio recommended (e.g. 1200×675). PNG/JPG up to 2 MB."
            />
            <ImageUploadField
              label="Thumbnail Image"
              currentUrl={currentThumbnailUrl}
              file={thumbnailFile}
              pickedUrl={thumbnailPickedUrl}
              onFileChange={(f) => { setThumbnailFile(f); setBrandingStatus("idle"); }}
              onPickFromLibrary={() => setPickerTarget("thumbnail")}
              onClear={() => { setThumbnailFile(null); setThumbnailPickedUrl(null); setBrandingStatus("idle"); }}
              uploadStatus={brandingStatus}
              hint="Used on program cards and listings. PNG/JPG up to 2 MB."
            />
          </div>
        </FormSection>

        <FormSection
          icon={GlobeAltIcon}
          title="Program Description"
          description="Full description displayed on the program landing page."
        >
          <textarea
            rows={5}
            value={formValues.description}
            onChange={(e) => updateField("description", e.target.value)}
            className={INPUT_CLS}
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
