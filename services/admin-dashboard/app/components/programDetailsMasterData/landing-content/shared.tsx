// services/admin-dashboard/app/components/programDetailsMasterData/landing-content/shared.tsx
// Copied verbatim from app/platform/brands/[brandId]/BrandDetailPage.tsx's
// module-private helpers (FieldInput, FieldTextarea, SheetMsg, clampFileTitle,
// normalizeBenefitGroup(s), DEFAULT_PAYMENT_INFO_ITEMS/normalizePaymentInfo,
// isImageMediaFile, BenefitGroupImageField) — Program's landing-content sheets
// need the same primitives BrandDetailPage.tsx's still-live old sheets use,
// but BrandDetailPage.tsx is out of scope for this task, so this is a copy,
// not a shared import.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Layers, Upload, X } from "lucide-react";
import { Label } from "@/src/ui/label";
import { Input } from "@/src/ui/input";
import { Button } from "@/src/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/ui/dialog";
import {
  listProgramMedia,
  type MediaFile,
} from "@/src/shared/api-client";
import { listPlatformPrograms, type PlatformProgram } from "@/app/platform/api";
import type { BenefitGroup, BenefitItem, BrandPaymentInfo, BrandPaymentInfoItem } from "@/app/platform/api";

const FILE_TITLE_MAX_LEN = 255;
export function clampFileTitle(filename: string): string {
  return filename.slice(0, FILE_TITLE_MAX_LEN);
}

export function FieldInput({
  label, id, value, onChange, placeholder, type = "text", hint, maxLength,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string; maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} />
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export function FieldTextarea({
  label, id, value, onChange, placeholder, rows = 3,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id} rows={rows} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      />
    </div>
  );
}

export function SheetMsg({ message, variant }: { message: string | null; variant: "error" | "success" }) {
  if (!message) return null;
  const cls = variant === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <p className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>{message}</p>;
}

export function normalizeBenefitGroup(group: Partial<BenefitGroup> | undefined, index: number): BenefitGroup {
  return {
    id: typeof group?.id === "string" && group.id.trim().length > 0 ? group.id : `group_${Date.now()}_${index}`,
    title: typeof group?.title === "string" ? group.title : "",
    imageUrl: typeof group?.imageUrl === "string" ? group.imageUrl : "",
    items:
      Array.isArray(group?.items) && group.items.length > 0
        ? group.items.map((item) => (typeof item === "string" ? item : ""))
        : ([""] as BenefitItem[]),
  };
}

export function normalizeBenefitGroups(groups: BenefitGroup[] | undefined): BenefitGroup[] {
  return (groups ?? []).map((group, index) => normalizeBenefitGroup(group, index));
}

export const DEFAULT_PAYMENT_INFO_ITEMS: BrandPaymentInfoItem[] = [
  { id: "payment-schedule", icon: "payment_schedule", title: "Payment Schedule", body: "All participants pay program fees in scheduled batches, not as a single upfront payment." },
  { id: "selection-quota", icon: "selection_quota", title: "Selection Quota", body: "Fully funded slots are limited and competitive based on qualifications and available funding." },
  { id: "fully-funded-process", icon: "fully_funded_process", title: "Fully Funded Process", body: "Complete the registration fee, submit the required documents and essay, and participate in the interview process." },
  { id: "self-funded-guarantee", icon: "self_funded_guarantee", title: "Refund Policy", body: "Self-funded participants who are declined receive a full refund in line with our refund policy." },
];

export function normalizePaymentInfo(value: BrandPaymentInfo | undefined): BrandPaymentInfo {
  const items = Array.isArray(value?.items) && value.items.length > 0
    ? value.items.map((item, index) => ({
        id: item.id?.trim() || `payment-item-${index + 1}`,
        icon: item.icon?.trim() || "payment_schedule",
        title: item.title ?? "",
        body: item.body ?? "",
      }))
    : DEFAULT_PAYMENT_INFO_ITEMS;

  return {
    eyebrow: value?.eyebrow ?? "Payment & Selection",
    title: value?.title ?? "Important information before you apply",
    introText: value?.introText ?? "Understand how the payment schedule and fully funded selection work so you can choose the best registration type for you.",
    items,
    note: value?.note ?? "All payments are processed securely. For queries, contact our support team.",
  };
}

function isImageMediaFile(file: MediaFile): boolean {
  return file.content_type?.startsWith("image/") ?? false;
}

// Verbatim copy of BrandDetailPage.tsx's BenefitGroupImageField. Still takes
// `brandId` — the media library is brand-scoped regardless of which surface
// (Brand or Program) is editing a benefit group, so this component needs no
// changes beyond being callable from a Program-scoped caller, which already
// has brandId available via programDetail.brand.id.
export function BenefitGroupImageField({
  brandId, groupId, value, pendingFile, onFileChange, onUrlChange, onClear,
}: {
  brandId: string; groupId: string; value?: string; pendingFile: File | null;
  onFileChange: (file: File | null) => void; onUrlChange: (url: string) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [programs, setPrograms] = useState<PlatformProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const pendingPreviewUrl = useMemo(() => (pendingFile ? URL.createObjectURL(pendingFile) : null), [pendingFile]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const loadFiles = useCallback(
    async (programId: string) => {
      if (!programId) {
        setFiles([]);
        setFilesError(null);
        return;
      }
      setFilesLoading(true);
      setFilesError(null);
      try {
        const result = await listProgramMedia({ programId, brandId, limit: 100 });
        setFiles((result.files ?? []).filter(isImageMediaFile));
      } catch (err) {
        setFiles([]);
        setFilesError(err instanceof Error ? err.message : "Failed to load media.");
      } finally {
        setFilesLoading(false);
      }
    },
    [brandId],
  );

  const openLibrary = useCallback(async () => {
    setPickerOpen(true);
    setSearch("");
    setProgramsLoading(true);
    setProgramsError(null);
    try {
      const result = await listPlatformPrograms({ brandId, limit: 100 });
      setPrograms(result.data);
      const nextProgramId = result.data[0]?.id ?? "";
      setSelectedProgramId(nextProgramId);
      if (nextProgramId) {
        await loadFiles(nextProgramId);
      } else {
        setFiles([]);
        setFilesError(null);
      }
    } catch (err) {
      setPrograms([]);
      setProgramsError(err instanceof Error ? err.message : "Failed to load programs.");
      setFiles([]);
      setFilesError(null);
    } finally {
      setProgramsLoading(false);
    }
  }, [brandId, loadFiles]);

  const previewUrl = pendingPreviewUrl ?? value ?? null;
  const visibleFiles = search.trim()
    ? files.filter((file) => (file.original_filename || file.filename || "").toLowerCase().includes(search.trim().toLowerCase()))
    : files;

  return (
    <div className="space-y-2">
      <Label htmlFor={`g-img-${groupId}`}>Image</Label>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div
          className="flex h-40 items-center justify-center bg-zinc-50 cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Benefit group preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <ImageIcon className="h-8 w-8" />
              <span className="text-xs">Upload or pick an image</span>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-zinc-100 p-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" type="button" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-1 h-3.5 w-3.5" /> Upload image
            </Button>
            <Button size="sm" variant="outline" type="button" onClick={() => void openLibrary()}>
              <Layers className="mr-1 h-3.5 w-3.5" /> Media library
            </Button>
            {(pendingFile || value) ? (
              <Button size="sm" variant="ghost" type="button" onClick={onClear}>
                <X className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
          </div>

          <Input
            id={`g-img-${groupId}`}
            value={value ?? ""}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs text-zinc-400">
            Paste a direct URL, upload a new image, or choose one from a program media library.
          </p>
          {pendingFile ? (
            <p className="text-xs font-medium text-blue-600">
              {pendingFile.name} selected. Save changes to upload and persist it.
            </p>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          onFileChange(file);
          event.target.value = "";
        }}
      />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b border-zinc-200 px-6 py-4">
            <DialogTitle>Pick Benefit Image</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 border-b border-zinc-200 bg-zinc-50/70 px-6 py-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor={`benefit-program-${groupId}`}>Program media library</Label>
                <select
                  id={`benefit-program-${groupId}`}
                  value={selectedProgramId}
                  onChange={(event) => {
                    const nextProgramId = event.target.value;
                    setSelectedProgramId(nextProgramId);
                    void loadFiles(nextProgramId);
                  }}
                  disabled={programsLoading || programs.length === 0}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {programs.length === 0 ? <option value="">No programs available</option> : null}
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`benefit-search-${groupId}`}>Search images</Label>
                <Input
                  id={`benefit-search-${groupId}`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search media files..."
                />
              </div>
            </div>

            {programsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {programsError}
              </div>
            ) : null}
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
            {programsLoading ? (
              <div className="py-12 text-center text-sm text-zinc-500">Loading programs…</div>
            ) : programs.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500">
                No programs are available for this brand yet. Upload a new image instead.
              </div>
            ) : filesLoading ? (
              <div className="py-12 text-center text-sm text-zinc-500">Loading media…</div>
            ) : filesError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {filesError}
              </div>
            ) : visibleFiles.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500">
                No matching images were found for the selected program.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {visibleFiles.map((file) => {
                  const url = file.url ?? file.download_url;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        if (!url) return;
                        onUrlChange(url);
                        setPickerOpen(false);
                      }}
                      className="overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
                    >
                      <div className="flex h-28 items-center justify-center bg-zinc-100">
                        {url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={url} alt={file.original_filename} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-zinc-300" />
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="truncate text-[11px] font-medium text-zinc-800">{file.original_filename}</p>
                        <p className="truncate text-[10px] text-zinc-400">{file.asset_type ?? file.content_type}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
