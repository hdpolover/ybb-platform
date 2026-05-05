"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  ImageIcon,
  Layers,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Save,
  Settings2,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { StatusBadge } from "@/src/admin/status-badge";
import { EmptyState } from "@/src/admin/empty-state";
import { Button } from "@/src/ui/button";
import { Badge } from "@/src/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/ui/dialog";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import { Skeleton } from "@/src/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { useAuth } from "@/app/contexts/AuthContext";
import { formatDate, parseApiDate, toLocalDatetimeInputValue } from "@/lib/utils";
import {
  listProgramMedia,
  uploadFileViaPresignedUrl,
  type MediaFile,
} from "@/src/shared/api-client";
import {
  getPlatformBrand,
  listPlatformPrograms,
  listBrandSponsors,
  listBrandSocialFeeds,
  createBrandSponsor,
  createBrandSocialFeed,
  updateBrandSponsor,
  updateBrandSocialFeed,
  deleteBrandSponsor,
  deleteBrandSocialFeed,
  listBrandAdmins,
  listAllAdmins,
  assignBrandAdmin,
  removeBrandAdmin,
  listEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  listLegalDocuments,
  createLegalDocument,
  updateLegalDocument,
  deleteLegalDocument,
  updatePlatformBrandIdentity,
  updatePlatformBrandDetails,
  updatePlatformBrandSettings,
  getBrandMetadata,
  updatePlatformBrandMetadata,
  type AdminOption,
  type BrandAdmin,
  type BrandSocialFeed,
  type BrandSponsor,
  type EmailTemplate,
  type LegalDocument,
  type PlatformBrandDetail,
  type PlatformProgram,
  type BrandMetadata,
  type BenefitGroup,
  type BrandFeature,
  type BrandImpactStats,
  type BrandPromoCta,
  type BrandMomentsShorts,
  type BrandProgramObjectives,
  type BrandFurtherInformation,
  type BrandPaymentInfo,
  type BrandPaymentInfoItem,
} from "../../api";

// ─── Field primitives ─────────────────────────────────────────────────────────

function FieldView({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-900">
        {value ?? <span className="text-zinc-400">—</span>}
      </p>
    </div>
  );
}


  function normalizeBenefitGroup(group: Partial<BenefitGroup> | undefined, index: number): BenefitGroup {
    return {
      id:
        typeof group?.id === "string" && group.id.trim().length > 0
          ? group.id
          : `group_${Date.now()}_${index}`,
      title: typeof group?.title === "string" ? group.title : "",
      imageUrl: typeof group?.imageUrl === "string" ? group.imageUrl : "",
      items:
        Array.isArray(group?.items) && group.items.length > 0
          ? group.items.map((item) => (typeof item === "string" ? item : ""))
          : [""],
    };
  }

  function normalizeBenefitGroups(groups: BenefitGroup[] | undefined): BenefitGroup[] {
    return (groups ?? []).map((group, index) => normalizeBenefitGroup(group, index));
  }

  const DEFAULT_PAYMENT_INFO_ITEMS: BrandPaymentInfoItem[] = [
    {
      id: "payment-schedule",
      icon: "payment_schedule",
      title: "Payment Schedule",
      body: "All participants pay program fees in scheduled batches, not as a single upfront payment.",
    },
    {
      id: "selection-quota",
      icon: "selection_quota",
      title: "Selection Quota",
      body: "Fully funded slots are limited and competitive based on qualifications and available funding.",
    },
    {
      id: "fully-funded-process",
      icon: "fully_funded_process",
      title: "Fully Funded Process",
      body: "Complete the registration fee, submit the required documents and essay, and participate in the interview process.",
    },
    {
      id: "self-funded-guarantee",
      icon: "self_funded_guarantee",
      title: "Refund Policy",
      body: "Self-funded participants who are declined receive a full refund in line with our refund policy.",
    },
  ];

  function normalizePaymentInfo(value: BrandPaymentInfo | undefined): BrandPaymentInfo {
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
      introText:
        value?.introText ??
        "Understand how the payment schedule and fully funded selection work so you can choose the best registration type for you.",
      items,
      note: value?.note ?? "All payments are processed securely. For queries, contact our support team.",
    };
  }

  function isImageMediaFile(file: MediaFile): boolean {
    return file.content_type?.startsWith("image/") ?? false;
  }

  function BenefitGroupImageField({
    brandId,
    groupId,
    value,
    pendingFile,
    onFileChange,
    onUrlChange,
    onClear,
  }: {
    brandId: string;
    groupId: string;
    value?: string;
    pendingFile: File | null;
    onFileChange: (file: File | null) => void;
    onUrlChange: (url: string) => void;
    onClear: () => void;
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
    const pendingPreviewUrl = useMemo(
      () => (pendingFile ? URL.createObjectURL(pendingFile) : null),
      [pendingFile],
    );

    useEffect(() => {
      return () => {
        if (pendingPreviewUrl) {
          URL.revokeObjectURL(pendingPreviewUrl);
        }
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
          const result = await listProgramMedia({
            programId,
            brandId,
            limit: 100,
          });
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
      ? files.filter((file) =>
          (file.original_filename || file.filename || "")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
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
                          if (!url) {
                            return;
                          }

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
function FieldInput({
  label, id, value, onChange, placeholder, type = "text", hint,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function FieldTextarea({
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

function FieldCheckbox({
  label, id, checked, onChange, hint,
}: {
  label: string; id: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-blue-600" />
      <div>
        <Label htmlFor={id} className="cursor-pointer">{label}</Label>
        {hint && <p className="text-xs text-zinc-400">{hint}</p>}
      </div>
    </div>
  );
}

function SheetMsg({ message, variant }: { message: string | null; variant: "error" | "success" }) {
  if (!message) return null;
  const cls = variant === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <p className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>{message}</p>;
}

function Section({
  title, action, children,
}: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      </CardContent>
    </Card>
  );
}

// ─── Inline Sheets ────────────────────────────────────────────────────────────

function IdentitySheet({ brand, onSaved }: { brand: PlatformBrandDetail; onSaved: () => void }) {
  const { adminProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: brand.name ?? "",
    slug: brand.slug ?? "",
    description: brand.description ?? "",
    websiteUrl: brand.websiteUrl ?? "",
    landingUrl: brand.landingUrl ?? "",
    primaryColor: brand.primaryColor ?? "",
    isActive: brand.isActive ?? true,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logoUrl ?? null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
    setSuccess(null);
  }

  function resetState() {
    setForm({
      name: brand.name ?? "",
      slug: brand.slug ?? "",
      description: brand.description ?? "",
      websiteUrl: brand.websiteUrl ?? "",
      landingUrl: brand.landingUrl ?? "",
      primaryColor: brand.primaryColor ?? "",
      isActive: brand.isActive ?? true,
    });
    setLogoFile(null);
    setLogoPreview(brand.logoUrl ?? null);
    setError(null);
    setSuccess(null);
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) setLogoPreview(URL.createObjectURL(file));
    setError(null);
    setSuccess(null);
  }

  async function handleSave() {
    if (logoFile && !adminProfile?.userId) {
      setError("Unable to upload logo without admin session.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updatePlatformBrandIdentity(brand.id, {
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        websiteUrl: form.websiteUrl || undefined,
        landingUrl: form.landingUrl || undefined,
        primaryColor: form.primaryColor || undefined,
        isActive: form.isActive,
        logo: logoFile ?? undefined,
        userId: adminProfile?.userId,
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); resetState(); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Identity
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Identity</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <SheetMsg message={success} variant="success" />

            {/* Logo */}
            <div className="space-y-1.5">
              <Label htmlFor="logoUpload">Logo</Label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-zinc-300" />
                  )}
                </div>
                <div className="flex-1">
                  <label htmlFor="logoUpload" className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 hover:border-zinc-400 hover:bg-zinc-100">
                    <Upload className="h-3.5 w-3.5" />
                    {logoFile ? logoFile.name : brand.logoUrl ? "Replace logo…" : "Upload logo…"}
                  </label>
                  <input id="logoUpload" type="file" accept="image/*" className="sr-only" onChange={onLogoChange} />
                  <p className="mt-1 text-xs text-zinc-400">PNG, JPG, SVG, WEBP. Square works best.</p>
                </div>
              </div>
            </div>

            <FieldInput label="Name" id="name" value={form.name} onChange={(v) => set("name", v)} placeholder="Brand name" />
            <FieldInput label="Slug" id="slug" value={form.slug} onChange={(v) => set("slug", v)} placeholder="brand-slug" hint="URL-friendly identifier" />
            <FieldTextarea label="Description" id="description" value={form.description} onChange={(v) => set("description", v)} placeholder="Short description" rows={3} />
            <FieldInput label="Website URL" id="websiteUrl" value={form.websiteUrl} onChange={(v) => set("websiteUrl", v)} placeholder="https://example.com" hint="Marketing / primary website (may differ from the landing deployment)." />
            <FieldInput label="Landing URL" id="landingUrl" value={form.landingUrl} onChange={(v) => set("landingUrl", v)} placeholder="https://chinayouthsummit.com" hint="Where the Next.js landing app is deployed. Drives cache revalidation when brand data changes." />
            <ColorField label="Primary Color" id="primaryColor" value={form.primaryColor} onChange={(v) => set("primaryColor", v)} />
            <FieldCheckbox label="Active" id="isActive" checked={form.isActive} onChange={(v) => set("isActive", v)} hint="Inactive brands are hidden from public view" />
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Native color picker + hex input with live swatch. Keeps the two inputs in
// sync. Invalid hex entries just skip syncing back to the color swatch but
// don't block typing (admin might be mid-edit).
function ColorField({
  label, id, value, onChange,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
}) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={safe}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-zinc-200 bg-white p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded"
        />
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1A2B3C"
          className="flex-1 font-mono uppercase"
          maxLength={7}
        />
      </div>
      <p className="text-xs text-zinc-400">Hex color — drives primary accents across the landing page.</p>
    </div>
  );
}

function DetailsSheet({ brand, onSaved }: { brand: PlatformBrandDetail; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    about: brand.about ?? "",
    vision: brand.vision ?? "",
    mission: brand.mission ?? "",
    defaultLocation: brand.defaultLocation ?? "",
    defaultCountry: brand.defaultCountry ?? "",
    defaultTimezone: brand.defaultTimezone ?? "",
    metaTitle: brand.metaTitle ?? "",
    metaDescription: brand.metaDescription ?? "",
    metaKeywords: brand.metaKeywords ?? "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null); setSuccess(null);
  }

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(null);
    try {
      await updatePlatformBrandDetails(brand.id, {
        about: form.about || undefined,
        vision: form.vision || undefined,
        mission: form.mission || undefined,
        defaultLocation: form.defaultLocation || undefined,
        defaultCountry: form.defaultCountry || undefined,
        defaultTimezone: form.defaultTimezone || undefined,
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
        metaKeywords: form.metaKeywords || undefined,
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); setError(null); setSuccess(null); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Details</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <SheetMsg message={success} variant="success" />
            <div className="space-y-2">
              <Label htmlFor="about">About</Label>
              <RichTextEditor
                content={form.about}
                onChange={(v) => set("about", v)}
                placeholder="Write about your program..."
                className="[&_.ProseMirror]:min-h-[160px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vision">Vision</Label>
              <RichTextEditor
                content={form.vision}
                onChange={(v) => set("vision", v)}
                placeholder="Write your vision..."
                className="[&_.ProseMirror]:min-h-[120px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mission">Mission</Label>
              <RichTextEditor
                content={form.mission}
                onChange={(v) => set("mission", v)}
                placeholder="Write your mission..."
                className="[&_.ProseMirror]:min-h-[120px]"
              />
            </div>
            <FieldInput label="Default Location" id="defaultLocation" value={form.defaultLocation} onChange={(v) => set("defaultLocation", v)} placeholder="Jakarta, Indonesia" />
            <FieldInput label="Default Country" id="defaultCountry" value={form.defaultCountry} onChange={(v) => set("defaultCountry", v)} placeholder="ID" />
            <FieldInput label="Default Timezone" id="defaultTimezone" value={form.defaultTimezone} onChange={(v) => set("defaultTimezone", v)} placeholder="Asia/Jakarta" />
            <div className="border-t border-zinc-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">SEO</p>
              <div className="space-y-4">
                <FieldInput label="Meta Title" id="metaTitle" value={form.metaTitle} onChange={(v) => set("metaTitle", v)} />
                <FieldInput label="Meta Description" id="metaDescription" value={form.metaDescription} onChange={(v) => set("metaDescription", v)} />
                <FieldInput label="Meta Keywords" id="metaKeywords" value={form.metaKeywords} onChange={(v) => set("metaKeywords", v)} />
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ContactSheet({ brand, onSaved }: { brand: PlatformBrandDetail; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    contactEmail: brand.contactEmail ?? "",
    contactPhone: brand.contactPhone ?? "",
    contactWhatsapp: brand.contactWhatsapp ?? "",
    contactAddress: brand.contactAddress ?? "",
    socialInstagram: brand.socialMediaLinks?.instagram ?? "",
    socialLinkedin: brand.socialMediaLinks?.linkedin ?? "",
    socialTwitter: brand.socialMediaLinks?.twitter ?? "",
    socialFacebook: brand.socialMediaLinks?.facebook ?? "",
    socialYoutube: brand.socialMediaLinks?.youtube ?? "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null); setSuccess(null);
  }

  function resetState() {
    setForm({
      contactEmail: brand.contactEmail ?? "",
      contactPhone: brand.contactPhone ?? "",
      contactWhatsapp: brand.contactWhatsapp ?? "",
      contactAddress: brand.contactAddress ?? "",
      socialInstagram: brand.socialMediaLinks?.instagram ?? "",
      socialLinkedin: brand.socialMediaLinks?.linkedin ?? "",
      socialTwitter: brand.socialMediaLinks?.twitter ?? "",
      socialFacebook: brand.socialMediaLinks?.facebook ?? "",
      socialYoutube: brand.socialMediaLinks?.youtube ?? "",
    });
    setError(null);
    setSuccess(null);
  }

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(null);
    const socialMediaLinks: Record<string, string> = {};
    if (form.socialInstagram) socialMediaLinks.instagram = form.socialInstagram;
    if (form.socialLinkedin) socialMediaLinks.linkedin = form.socialLinkedin;
    if (form.socialTwitter) socialMediaLinks.twitter = form.socialTwitter;
    if (form.socialFacebook) socialMediaLinks.facebook = form.socialFacebook;
    if (form.socialYoutube) socialMediaLinks.youtube = form.socialYoutube;
    try {
      await updatePlatformBrandDetails(brand.id, {
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        contactWhatsapp: form.contactWhatsapp || undefined,
        contactAddress: form.contactAddress || undefined,
        socialMediaLinks: Object.keys(socialMediaLinks).length > 0 ? socialMediaLinks : undefined,
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { resetState(); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Contact</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <SheetMsg message={success} variant="success" />
            <FieldInput label="Email" id="contactEmail" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} type="email" placeholder="contact@brand.com" />
            <FieldInput label="Phone" id="contactPhone" value={form.contactPhone} onChange={(v) => set("contactPhone", v)} placeholder="+62 21 1234 5678" />
            <FieldInput label="WhatsApp" id="contactWhatsapp" value={form.contactWhatsapp} onChange={(v) => set("contactWhatsapp", v)} placeholder="+62811234567" />
            <FieldTextarea label="Address" id="contactAddress" value={form.contactAddress} onChange={(v) => set("contactAddress", v)} rows={3} />
            <div className="border-t border-zinc-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Social Media</p>
              <div className="space-y-4">
                <FieldInput label="Instagram" id="socialInstagram" value={form.socialInstagram} onChange={(v) => set("socialInstagram", v)} placeholder="https://instagram.com/..." />
                <FieldInput label="LinkedIn" id="socialLinkedin" value={form.socialLinkedin} onChange={(v) => set("socialLinkedin", v)} placeholder="https://linkedin.com/..." />
                <FieldInput label="Twitter / X" id="socialTwitter" value={form.socialTwitter} onChange={(v) => set("socialTwitter", v)} placeholder="https://twitter.com/..." />
                <FieldInput label="Facebook" id="socialFacebook" value={form.socialFacebook} onChange={(v) => set("socialFacebook", v)} placeholder="https://facebook.com/..." />
                <FieldInput label="YouTube" id="socialYoutube" value={form.socialYoutube} onChange={(v) => set("socialYoutube", v)} placeholder="https://youtube.com/..." />
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SettingsSheet({ brand, onSaved }: { brand: PlatformBrandDetail; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    defaultCurrency: brand.defaultCurrency ?? "IDR",
    enableMultiCurrency: brand.enableMultiCurrency ?? false,
    usdInIdr: String(brand.settings?.usdInIdr ?? ""),
    isMaintenanceMode: brand.settings?.isMaintenanceMode ?? false,
    maintenanceMessage: brand.settings?.maintenanceMessage ?? "",
    supportEmail: brand.settings?.supportEmail ?? "",
    googleAnalyticsId: brand.settings?.googleAnalyticsId ?? "",
    pixelId: brand.settings?.pixelId ?? "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null); setSuccess(null);
  }

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(null);
    try {
      await updatePlatformBrandSettings(brand.id, {
        defaultCurrency: form.defaultCurrency || undefined,
        enableMultiCurrency: form.enableMultiCurrency,
        usdInIdr: form.usdInIdr ? Number(form.usdInIdr) : undefined,
        isMaintenanceMode: form.isMaintenanceMode,
        maintenanceMessage: form.maintenanceMessage || undefined,
        supportEmail: form.supportEmail || undefined,
        googleAnalyticsId: form.googleAnalyticsId || undefined,
        pixelId: form.pixelId || undefined,
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); setError(null); setSuccess(null); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Settings</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <SheetMsg message={success} variant="success" />
            <FieldInput label="Default Currency" id="defaultCurrency" value={form.defaultCurrency} onChange={(v) => set("defaultCurrency", v)} placeholder="IDR" />
            <FieldCheckbox label="Enable Multi-Currency" id="enableMultiCurrency" checked={form.enableMultiCurrency} onChange={(v) => set("enableMultiCurrency", v)} />
            <FieldInput label="USD → IDR Rate" id="usdInIdr" value={form.usdInIdr} onChange={(v) => set("usdInIdr", v)} type="number" placeholder="16000" />
            <div className="border-t border-zinc-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Maintenance</p>
              <div className="space-y-4">
                <FieldCheckbox label="Enable Maintenance Mode" id="isMaintenanceMode" checked={form.isMaintenanceMode} onChange={(v) => set("isMaintenanceMode", v)} />
                <FieldInput label="Maintenance Message" id="maintenanceMessage" value={form.maintenanceMessage} onChange={(v) => set("maintenanceMessage", v)} placeholder="We'll be back soon." />
                <FieldInput label="Support Email" id="supportEmail" value={form.supportEmail} onChange={(v) => set("supportEmail", v)} type="email" placeholder="support@brand.com" />
              </div>
            </div>
            <div className="border-t border-zinc-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Tracking</p>
              <div className="space-y-4">
                <FieldInput label="Google Analytics ID" id="googleAnalyticsId" value={form.googleAnalyticsId} onChange={(v) => set("googleAnalyticsId", v)} placeholder="G-XXXXXXXXXX" />
                <FieldInput label="Pixel ID" id="pixelId" value={form.pixelId} onChange={(v) => set("pixelId", v)} placeholder="123456789" />
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ brand, onSaved }: { brand: PlatformBrandDetail; onSaved: () => void }) {
  return (
    <div className="space-y-4">

      <Section
        title="About"
        action={<DetailsSheet brand={brand} onSaved={onSaved} />}
      >
        {brand.about ? (
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-zinc-500">About</p>
            <div
              className="mt-0.5 text-sm text-zinc-900 [&_a]:text-blue-600 [&_a]:underline [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: brand.about }}
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-400 sm:col-span-2">No description added yet.</p>
        )}
        {brand.vision && (
          <div>
            <p className="text-xs font-medium text-zinc-500">Vision</p>
            <div
              className="mt-0.5 text-sm text-zinc-900 [&_a]:text-blue-600 [&_a]:underline [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: brand.vision }}
            />
          </div>
        )}
        {brand.mission && (
          <div>
            <p className="text-xs font-medium text-zinc-500">Mission</p>
            <div
              className="mt-0.5 text-sm text-zinc-900 [&_a]:text-blue-600 [&_a]:underline [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: brand.mission }}
            />
          </div>
        )}
      </Section>

      <Section title="Locale">
        <FieldView label="Default Location" value={brand.defaultLocation} />
        <FieldView label="Default Country" value={brand.defaultCountry} />
        <FieldView label="Default Timezone" value={brand.defaultTimezone} />
        <FieldView label="Default Currency" value={brand.defaultCurrency} />
        <div>
          <p className="text-xs font-medium text-zinc-500">Multi-Currency</p>
          <p className="mt-0.5 text-sm text-zinc-900">{brand.enableMultiCurrency ? "Enabled" : "Disabled"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500">Email Verification Required</p>
          <p className="mt-0.5 text-sm text-zinc-900">{brand.requireEmailVerification ? "Yes" : "No"}</p>
        </div>
      </Section>

      {(brand.metaTitle || brand.metaDescription || brand.metaKeywords) && (
        <Section title="SEO">
          <FieldView label="Meta Title" value={brand.metaTitle} />
          <FieldView label="Meta Description" value={brand.metaDescription} />
          <FieldView label="Meta Keywords" value={brand.metaKeywords} />
        </Section>
      )}
    </div>
  );
}

// ─── Tab: Programs ────────────────────────────────────────────────────────────

function ProgramsTab({ brandId }: { brandId: string }) {
  const [programs, setPrograms] = useState<PlatformProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    listPlatformPrograms({ brandId, limit: 100 })
      .then((res) => {
        if (mounted) {
          setError(null);
          setPrograms(res.data);
        }
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load programs.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [brandId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
        Loading programs…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
        <Layers className="mx-auto h-8 w-8 text-zinc-300" />
        <p className="mt-2 text-sm font-medium text-zinc-500">No programs yet</p>
        <p className="text-xs text-zinc-400">Programs created under this brand will appear here.</p>
      </div>
    );
  }

  const statusVariant: Record<string, "secondary" | "info" | "success" | "warning" | "destructive"> = {
    draft: "secondary",
    published: "info",
    ongoing: "success",
    completed: "secondary",
    cancelled: "destructive",
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100">
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Program</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Year</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Deadline</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Visibility</th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => (
            <tr key={p.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
              <td className="px-4 py-3">
                <p className="font-medium text-zinc-900">{p.name}</p>
                <p className="font-mono text-xs text-zinc-400">{p.slug}</p>
              </td>
              <td className="px-4 py-3 text-zinc-600">{p.year}</td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[p.status] ?? "secondary"}>
                  {p.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-zinc-500">
                {formatDate(p.applicationDeadline)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {p.isPublished && <Badge variant="success">Published</Badge>}
                  {!p.isPublished && <Badge variant="secondary">Unpublished</Badge>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-zinc-200 px-4 py-2.5">
        <p className="text-xs text-zinc-400">{programs.length} program{programs.length !== 1 ? "s" : ""}</p>
      </div>
    </div>
  );
}

// ─── Tab: Contact ─────────────────────────────────────────────────────────────

function ContactTab({ brand, onSaved }: { brand: PlatformBrandDetail; onSaved: () => void }) {
  const social = brand.socialMediaLinks ?? {};
  const hasSocial = Object.keys(social).length > 0;

  return (
    <div className="space-y-4">
      <Section title="Contact Information" action={<ContactSheet brand={brand} onSaved={onSaved} />}>
        <div>
          <p className="text-xs font-medium text-zinc-500">Email</p>
          {brand.contactEmail ? (
            <a href={`mailto:${brand.contactEmail}`} className="mt-0.5 flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <Mail className="h-3.5 w-3.5" /> {brand.contactEmail}
            </a>
          ) : (
            <p className="mt-0.5 text-sm text-zinc-400">—</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500">Phone</p>
          {brand.contactPhone ? (
            <a href={`tel:${brand.contactPhone}`} className="mt-0.5 flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <Phone className="h-3.5 w-3.5" /> {brand.contactPhone}
            </a>
          ) : (
            <p className="mt-0.5 text-sm text-zinc-400">—</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500">WhatsApp</p>
          {brand.contactWhatsapp ? (
            <a
              href={`https://wa.me/${brand.contactWhatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 flex items-center gap-1 text-sm text-green-600 hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" /> {brand.contactWhatsapp}
            </a>
          ) : (
            <p className="mt-0.5 text-sm text-zinc-400">—</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500">Address</p>
          {brand.contactAddress ? (
            <p className="mt-0.5 flex items-start gap-1 text-sm text-zinc-900">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" /> {brand.contactAddress}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-zinc-400">—</p>
          )}
        </div>
      </Section>

      <Card>
        <CardHeader>
          <CardTitle>Social Media</CardTitle>
        </CardHeader>
        <CardContent>
          {hasSocial ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(social).map(([platform, url]) => (
                <div key={platform}>
                  <p className="text-xs font-medium capitalize text-zinc-500">{platform}</p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span className="truncate">{url}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No social media links configured.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Settings ────────────────────────────────────────────────────────────

function SettingsTab({ brand, onSaved }: { brand: PlatformBrandDetail; onSaved: () => void }) {
  const s = brand.settings;

  return (
    <div className="space-y-4">
      <Section title="Currency" action={<SettingsSheet brand={brand} onSaved={onSaved} />}>
        <FieldView label="Default Currency" value={brand.defaultCurrency} />
        <FieldView label="USD → IDR Rate" value={s?.usdInIdr != null ? `Rp ${Number(s.usdInIdr).toLocaleString()}` : undefined} />
        <div>
          <p className="text-xs font-medium text-zinc-500">Multi-Currency</p>
          <p className="mt-0.5">
            <Badge variant={brand.enableMultiCurrency ? "success" : "secondary"}>
              {brand.enableMultiCurrency ? "Enabled" : "Disabled"}
            </Badge>
          </p>
        </div>
      </Section>

      <Section title="Maintenance">
        <div>
          <p className="text-xs font-medium text-zinc-500">Maintenance Mode</p>
          <p className="mt-0.5">
            {s?.isMaintenanceMode ? (
              <Badge variant="warning">Active</Badge>
            ) : (
              <Badge variant="secondary">Off</Badge>
            )}
          </p>
        </div>
        {s?.maintenanceMessage && (
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-zinc-500">Maintenance Message</p>
            <p className="mt-0.5 text-sm text-zinc-900">{s.maintenanceMessage}</p>
          </div>
        )}
        <FieldView label="Support Email" value={s?.supportEmail} />
      </Section>

      <Section title="Integrations & Analytics">
        <FieldView label="Google Analytics ID" value={s?.googleAnalyticsId} />
        <FieldView label="Pixel ID" value={s?.pixelId} />
      </Section>
    </div>
  );
}

// ─── Tab: Landing Page ────────────────────────────────────────────────────────

// ─── Benefits Sheet ──────────────────────────────────────────────────────────

function BenefitsSheet({
  brandId,
  initial,
  onSaved,
}: {
  brandId: string;
  initial: BrandMetadata["benefits"];
  onSaved: (updated: BrandMetadata) => void;
}) {
  const { adminProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eyebrow, setEyebrow] = useState(initial?.eyebrow ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [groups, setGroups] = useState<BenefitGroup[]>(normalizeBenefitGroups(initial?.groups));
  const [pendingImages, setPendingImages] = useState<Record<string, File | null>>({});

  function resetState() {
    setEyebrow(initial?.eyebrow ?? "");
    setTitle(initial?.title ?? "");
    setGroups(normalizeBenefitGroups(initial?.groups));
    setPendingImages({});
    setError(null);
  }

  function addGroup() {
    setGroups((gs) => [
      ...gs,
      normalizeBenefitGroup({ title: "", imageUrl: "", items: [""] }, gs.length),
    ]);
  }

  function removeGroup(idx: number) {
    setGroups((gs) => {
      const target = gs[idx];
      if (target) {
        setPendingImages((current) => {
          const next = { ...current };
          delete next[target.id];
          return next;
        });
      }

      return gs.filter((_, i) => i !== idx);
    });
  }

  function setGroupField(idx: number, field: keyof BenefitGroup, value: string) {
    setGroups((gs) =>
      gs.map((g, i) => (i === idx ? { ...g, [field]: value } : g)),
    );
  }

  function setGroupImageFile(idx: number, file: File | null) {
    setGroups((gs) => {
      const target = gs[idx];
      if (!target) {
        return gs;
      }

      setPendingImages((current) => ({
        ...current,
        [target.id]: file,
      }));

      return gs;
    });
  }

  function setGroupImageUrl(idx: number, url: string) {
    setGroups((gs) =>
      gs.map((group, groupIndex) =>
        groupIndex === idx ? { ...group, imageUrl: url } : group,
      ),
    );

    setPendingImages((current) => {
      const target = groups[idx];
      if (!target) {
        return current;
      }

      const next = { ...current };
      delete next[target.id];
      return next;
    });
  }

  function clearGroupImage(idx: number) {
    setGroups((gs) =>
      gs.map((group, groupIndex) =>
        groupIndex === idx ? { ...group, imageUrl: "" } : group,
      ),
    );

    setPendingImages((current) => {
      const target = groups[idx];
      if (!target) {
        return current;
      }

      const next = { ...current };
      delete next[target.id];
      return next;
    });
  }

  function setGroupItems(idx: number, items: string[]) {
    setGroups((gs) => gs.map((g, i) => (i === idx ? { ...g, items } : g)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (Object.values(pendingImages).some(Boolean) && !adminProfile?.userId) {
        throw new Error("An admin user session is required before images can be uploaded.");
      }

      const resolvedGroups = await Promise.all(
        groups.map(async (group) => {
          const pendingFile = pendingImages[group.id];
          let imageUrl = group.imageUrl || undefined;

          if (pendingFile) {
            const upload = await uploadFileViaPresignedUrl(pendingFile, {
              userId: adminProfile!.userId,
              brandId,
              bucket: "brands",
              assetType: "image",
              title: pendingFile.name,
              altText: group.title || title || eyebrow || "Benefit group image",
            });

            if (!upload.publicUrl) {
              throw new Error(`Image upload succeeded for ${pendingFile.name} but no public URL was returned.`);
            }

            imageUrl = upload.publicUrl;
          }

          return {
            ...group,
            imageUrl,
            items: group.items.map((item) => item.trim()).filter(Boolean),
          };
        }),
      );

      const updated = await updatePlatformBrandMetadata(brandId, {
        benefits: {
          eyebrow,
          title,
          groups: resolvedGroups,
        },
      });
      onSaved(updated);
      setPendingImages({});
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { resetState(); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Program Benefits</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <SheetMsg message={error} variant="error" />
            <FieldInput label="Eyebrow text" id="ben-eyebrow" value={eyebrow} onChange={setEyebrow} placeholder="Program Benefits" />
            <FieldInput label="Section title" id="ben-title" value={title} onChange={setTitle} placeholder="Built for Students & Professionals" />

            <div className="border-t border-zinc-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Audience Groups</p>
                <Button size="sm" variant="outline" onClick={addGroup}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Group
                </Button>
              </div>
              <div className="space-y-4">
                {groups.map((group, gi) => (
                  <div key={group.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-zinc-500">Group {gi + 1}</p>
                      <Button size="sm" variant="ghost" onClick={() => removeGroup(gi)}>
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                    <FieldInput label="Title" id={`g-title-${gi}`} value={group.title} onChange={(v) => setGroupField(gi, "title", v)} placeholder="Benefits for High School Students" />
                    <BenefitGroupImageField
                      brandId={brandId}
                      groupId={group.id}
                      value={group.imageUrl}
                      pendingFile={pendingImages[group.id] ?? null}
                      onFileChange={(file) => setGroupImageFile(gi, file)}
                      onUrlChange={(url) => setGroupImageUrl(gi, url)}
                      onClear={() => clearGroupImage(gi)}
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Benefit Items</Label>
                        <button
                          type="button"
                          className="text-xs text-blue-500 hover:underline"
                          onClick={() => setGroupItems(gi, [...group.items, ""])}
                        >
                          + Add item
                        </button>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((item, ii) => (
                          <div key={ii} className="flex gap-2">
                            <input
                              className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              value={item}
                              placeholder={`Item ${ii + 1}`}
                              onChange={(e) => {
                                const newItems = [...group.items];
                                newItems[ii] = e.target.value;
                                setGroupItems(gi, newItems);
                              }}
                            />
                            <button
                              type="button"
                              className="shrink-0 text-zinc-400 hover:text-red-500"
                              onClick={() => setGroupItems(gi, group.items.filter((_, i) => i !== ii))}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="py-4 text-center text-sm text-zinc-400">No groups yet. Add a group to create one.</p>
                )}
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Features Sheet ───────────────────────────────────────────────────────────

function FeaturesSheet({
  brandId,
  initial,
  onSaved,
}: {
  brandId: string;
  initial: BrandFeature[] | undefined;
  onSaved: (updated: BrandMetadata) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<BrandFeature[]>(initial ?? []);

  function resetState() {
    setFeatures(initial ?? []);
    setError(null);
  }

  function addFeature() {
    setFeatures((fs) => [
      ...fs,
      { id: `f${Date.now()}`, icon: "star", title: "", description: "" },
    ]);
  }

  function setFeatureField(idx: number, field: keyof BrandFeature, value: string) {
    setFeatures((fs) =>
      fs.map((f, i) => (i === idx ? { ...f, [field]: value } : f)),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePlatformBrandMetadata(brandId, { features });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { resetState(); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Key Features</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <SheetMsg message={error} variant="error" />
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Features</p>
              <Button size="sm" variant="outline" onClick={addFeature}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Feature
              </Button>
            </div>
            <div className="space-y-4">
              {features.map((f, fi) => (
                <div key={fi} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-zinc-500">Feature {fi + 1}</p>
                    <Button size="sm" variant="ghost" onClick={() => setFeatures((fs) => fs.filter((_, i) => i !== fi))}>
                      <X className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldInput label="Icon key" id={`f-icon-${fi}`} value={f.icon} onChange={(v) => setFeatureField(fi, "icon", v)} placeholder="globe" />
                    <FieldInput label="Title" id={`f-title-${fi}`} value={f.title} onChange={(v) => setFeatureField(fi, "title", v)} placeholder="Feature title" />
                  </div>
                  <FieldTextarea label="Description" id={`f-desc-${fi}`} value={f.description} onChange={(v) => setFeatureField(fi, "description", v)} rows={2} />
                </div>
              ))}
              {features.length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-4">No features yet.</p>
              )}
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Impact Stats Sheet ───────────────────────────────────────────────────────

function ImpactStatsSheet({
  brandId,
  initial,
  onSaved,
}: {
  brandId: string;
  initial: BrandImpactStats | undefined;
  onSaved: (updated: BrandMetadata) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BrandImpactStats>(initial ?? {});

  function set(k: keyof BrandImpactStats, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePlatformBrandMetadata(brandId, { impact_stats: form });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setForm(initial ?? {}); setError(null); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Impact Stats</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <FieldInput label="Total Participants" id="stat-participants" value={form.total_participants ?? ""} onChange={(v) => set("total_participants", v)} placeholder="8,500+" />
            <FieldInput label="Total Countries" id="stat-countries" value={form.total_countries ?? ""} onChange={(v) => set("total_countries", v)} placeholder="62" />
            <FieldInput label="Total Alumni" id="stat-alumni" value={form.total_alumni ?? ""} onChange={(v) => set("total_alumni", v)} placeholder="7,200+" />
            <FieldInput label="Editions Held" id="stat-editions" value={form.editions_held ?? ""} onChange={(v) => set("editions_held", v)} placeholder="5" />
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Promo CTA Sheet ──────────────────────────────────────────────────────────

function PromoCtaSheet({
  brandId,
  initial,
  onSaved,
}: {
  brandId: string;
  initial: BrandPromoCta | undefined;
  onSaved: (updated: BrandMetadata) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BrandPromoCta>(initial ?? {});

  function set(k: keyof BrandPromoCta, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePlatformBrandMetadata(brandId, { promo_cta: form });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setForm(initial ?? {}); setError(null); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Promo CTA</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <FieldInput label="Eyebrow" id="cta-eyebrow" value={form.eyebrow ?? ""} onChange={(v) => set("eyebrow", v)} placeholder="Ready to Lead?" />
            <FieldInput label="Title" id="cta-title" value={form.title ?? ""} onChange={(v) => set("title", v)} placeholder="Join the Summit!" />
            <FieldTextarea label="Subtitle" id="cta-subtitle" value={form.subtitle ?? ""} onChange={(v) => set("subtitle", v)} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Button Label" id="cta-label" value={form.primary_cta_label ?? ""} onChange={(v) => set("primary_cta_label", v)} placeholder="Apply Now" />
              <FieldInput label="Button URL" id="cta-href" value={form.primary_cta_href ?? ""} onChange={(v) => set("primary_cta_href", v)} placeholder="/apply" />
            </div>
            <div className="border-t border-zinc-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Background</p>
              <div className="space-y-3">
                <FieldInput label="Desktop Background Image URL" id="cta-bg-desktop" value={form.background_image_url ?? ""} onChange={(v) => set("background_image_url", v)} placeholder="https://... or /img/ctabekground.png" />
                <FieldInput label="Mobile Background Image URL" id="cta-bg-mobile" value={form.background_image_mobile_url ?? ""} onChange={(v) => set("background_image_mobile_url", v)} placeholder="https://... or /img/ctabackgroundformobile.png" />
              </div>
            </div>
            <div className="border-t border-zinc-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Video</p>
              <div className="space-y-3">
                <FieldInput label="Embed URL" id="cta-video" value={form.video_url ?? ""} onChange={(v) => set("video_url", v)} placeholder="https://youtube.com/embed/..." />
                <FieldInput label="Video Title" id="cta-vtitle" value={form.video_title ?? ""} onChange={(v) => set("video_title", v)} placeholder="Registration Guideline" />
                <FieldTextarea label="Video Description" id="cta-vdesc" value={form.video_description ?? ""} onChange={(v) => set("video_description", v)} rows={2} />
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function FurtherInformationSheet({
  brandId,
  initial,
  onSaved,
}: {
  brandId: string;
  initial: BrandFurtherInformation | undefined;
  onSaved: (updated: BrandMetadata) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BrandFurtherInformation>(initial ?? {});

  function set<K extends keyof BrandFurtherInformation>(key: K, value: BrandFurtherInformation[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePlatformBrandMetadata(brandId, {
        further_information: {
          eyebrow: form.eyebrow?.trim() || undefined,
          title: form.title?.trim() || undefined,
          subtitle: form.subtitle?.trim() || undefined,
          background_image_url: form.background_image_url?.trim() || undefined,
          background_image_mobile_url: form.background_image_mobile_url?.trim() || undefined,
          mockup_image_url: form.mockup_image_url?.trim() || undefined,
        },
      });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setForm(initial ?? {});
          setError(null);
          setOpen(true);
        }}
      >
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Further Information CTA</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <FieldInput
              label="Eyebrow"
              id="fi-eyebrow"
              value={form.eyebrow ?? ""}
              onChange={(v) => set("eyebrow", v)}
              placeholder="Guidebook"
            />
            <FieldInput
              label="Title"
              id="fi-title"
              value={form.title ?? ""}
              onChange={(v) => set("title", v)}
              placeholder="Further Information"
            />
            <FieldTextarea
              label="Subtitle"
              id="fi-subtitle"
              value={form.subtitle ?? ""}
              onChange={(v) => set("subtitle", v)}
              rows={3}
            />
            <div className="border-t border-zinc-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Images</p>
              <div className="space-y-3">
                <FieldInput
                  label="Desktop Background Image URL"
                  id="fi-bg-desktop"
                  value={form.background_image_url ?? ""}
                  onChange={(v) => set("background_image_url", v)}
                  placeholder="https://... or /img/halfback.png"
                />
                <FieldInput
                  label="Mobile Background Image URL"
                  id="fi-bg-mobile"
                  value={form.background_image_mobile_url ?? ""}
                  onChange={(v) => set("background_image_mobile_url", v)}
                  placeholder="https://... or /img/backgroundformobile.png"
                />
                <FieldInput
                  label="Mockup Image URL"
                  id="fi-mockup"
                  value={form.mockup_image_url ?? ""}
                  onChange={(v) => set("mockup_image_url", v)}
                  placeholder="https://... or /img/mockupjapan.png"
                />
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Moments Shorts Sheet ─────────────────────────────────────────────────────

function MomentsShortsSheet({
  brandId,
  initial,
  onSaved,
}: {
  brandId: string;
  initial: BrandMomentsShorts | undefined;
  onSaved: (updated: BrandMetadata) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BrandMomentsShorts>(initial ?? {});

  function set(k: keyof BrandMomentsShorts, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePlatformBrandMetadata(brandId, { moments_shorts: form });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setForm(initial ?? {}); setError(null); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Moments Shorts</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <FieldInput label="Eyebrow" id="ms-eyebrow" value={form.eyebrow ?? ""} onChange={(v) => set("eyebrow", v)} placeholder="Short Highlights" />
            <FieldInput label="Title" id="ms-title" value={form.title ?? ""} onChange={(v) => set("title", v)} placeholder="Discover Our Moments in 60 Seconds" />
            <FieldTextarea label="Description" id="ms-desc" value={form.description ?? ""} onChange={(v) => set("description", v)} rows={3} />
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Program Objectives Sheet ───────────────────────────────────────────────────

function ProgramObjectivesSheet({
  brandId,
  initial,
  onSaved,
}: {
  brandId: string;
  initial: BrandProgramObjectives | undefined;
  onSaved: (updated: BrandMetadata) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BrandProgramObjectives>(initial ?? {});

  function resetState() {
    setForm(initial ?? {});
    setError(null);
  }

  function setField<K extends keyof BrandProgramObjectives>(key: K, value: BrandProgramObjectives[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function setItemsFromTextArea(value: string) {
    setField(
      "items",
      value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePlatformBrandMetadata(brandId, {
        program_objectives: {
          eyebrow: form.eyebrow?.trim() || undefined,
          title: form.title?.trim() || undefined,
          intro: form.intro?.trim() || undefined,
          items: (form.items ?? []).map((item) => item.trim()).filter(Boolean),
        },
      });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { resetState(); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Program Objectives</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <FieldInput
              label="Eyebrow"
              id="po-eyebrow"
              value={form.eyebrow ?? ""}
              onChange={(v) => setField("eyebrow", v)}
              placeholder="Program Objective"
            />
            <FieldInput
              label="Title"
              id="po-title"
              value={form.title ?? ""}
              onChange={(v) => setField("title", v)}
              placeholder="Program Objectives"
            />
            <FieldTextarea
              label="Intro Paragraph"
              id="po-intro"
              value={form.intro ?? ""}
              onChange={(v) => setField("intro", v)}
              rows={4}
            />
            <FieldTextarea
              label="Objective Items (one per line)"
              id="po-items"
              value={(form.items ?? []).join("\n")}
              onChange={setItemsFromTextArea}
              rows={7}
            />
            <p className="text-xs text-zinc-400">
              If this is empty, the landing page uses objectives from the active program.
            </p>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Landing Page Tab ─────────────────────────────────────────────────────────

function LandingPageTab({ brandId }: { brandId: string }) {
  const [meta, setMeta] = useState<BrandMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getBrandMetadata(brandId);
      setMeta(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load metadata.");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-sm text-zinc-400 py-8 text-center">Loading…</p>;
  if (fetchError) return <p className="text-sm text-red-500 py-8 text-center">{fetchError}</p>;
  if (!meta) return null;
  const paymentInfo = normalizePaymentInfo(meta.payment_info);

  return (
    <div className="space-y-4">
      {/* Benefits */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Program Benefits</CardTitle>
            <BenefitsSheet brandId={brandId} initial={meta.benefits} onSaved={setMeta} />
          </div>
        </CardHeader>
        <CardContent>
          {meta.benefits ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldView label="Eyebrow" value={meta.benefits.eyebrow} />
                <FieldView label="Title" value={meta.benefits.title} />
              </div>
              <div className="space-y-2">
                {meta.benefits.groups.map((g, i) => (
                  <div key={i} className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
                    <p className="text-sm font-medium text-zinc-800">{g.title || <span className="text-zinc-400">Untitled group</span>}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{g.items.length} items{g.imageUrl ? " · has image" : ""}</p>
                  </div>
                ))}
                {meta.benefits.groups.length === 0 && <p className="text-sm text-zinc-400">No groups defined.</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No benefits data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Key Features */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Key Features</CardTitle>
            <FeaturesSheet brandId={brandId} initial={meta.features} onSaved={setMeta} />
          </div>
        </CardHeader>
        <CardContent>
          {meta.features && meta.features.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {meta.features.map((f, i) => (
                <div key={i} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-sm font-medium text-zinc-800">{f.title}</p>
                  <p className="text-xs text-zinc-400">icon: {f.icon}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No features defined.</p>
          )}
        </CardContent>
      </Card>

      {/* Impact Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Impact Stats</CardTitle>
            <ImpactStatsSheet brandId={brandId} initial={meta.impact_stats} onSaved={setMeta} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldView label="Total Participants" value={meta.impact_stats?.total_participants} />
            <FieldView label="Total Countries" value={meta.impact_stats?.total_countries} />
            <FieldView label="Total Alumni" value={meta.impact_stats?.total_alumni} />
            <FieldView label="Editions Held" value={meta.impact_stats?.editions_held} />
          </div>
        </CardContent>
      </Card>

      {/* Payment & Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment &amp; Selection Section</CardTitle>
            <PaymentInfoSheet brandId={brandId} initial={meta.payment_info} onSaved={setMeta} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldView label="Eyebrow" value={paymentInfo.eyebrow} />
              <FieldView label="Title" value={paymentInfo.title} />
            </div>
            <FieldView label="Intro Text" value={paymentInfo.introText} />
            <div className="space-y-2">
              {paymentInfo.items.map((item, index) => (
                <div key={item.id || index} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-sm font-medium text-zinc-800">{item.title || `Item ${index + 1}`}</p>
                  <p className="text-xs text-zinc-500">id: {item.id} · icon: {item.icon}</p>
                  <p className="mt-1 text-sm text-zinc-700">{item.body || <span className="text-zinc-400">No body text</span>}</p>
                </div>
              ))}
            </div>
            <FieldView label="Note" value={paymentInfo.note} />
          </div>
        </CardContent>
      </Card>

      {/* Promo CTA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Promo / CTA Section</CardTitle>
            <PromoCtaSheet brandId={brandId} initial={meta.promo_cta} onSaved={setMeta} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldView label="Eyebrow" value={meta.promo_cta?.eyebrow} />
            <FieldView label="Button Label" value={meta.promo_cta?.primary_cta_label} />
            <FieldView label="Title" value={meta.promo_cta?.title} />
            <FieldView label="Button URL" value={meta.promo_cta?.primary_cta_href} />
            <FieldView label="Desktop Background URL" value={meta.promo_cta?.background_image_url} />
            <FieldView label="Mobile Background URL" value={meta.promo_cta?.background_image_mobile_url} />
          </div>
        </CardContent>
      </Card>

      {/* Further Information CTA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Further Information CTA Section</CardTitle>
            <FurtherInformationSheet brandId={brandId} initial={meta.further_information} onSaved={setMeta} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldView label="Eyebrow" value={meta.further_information?.eyebrow} />
            <FieldView label="Title" value={meta.further_information?.title} />
            <FieldView label="Subtitle" value={meta.further_information?.subtitle} />
            <FieldView label="Desktop Background URL" value={meta.further_information?.background_image_url} />
            <FieldView label="Mobile Background URL" value={meta.further_information?.background_image_mobile_url} />
            <FieldView label="Mockup Image URL" value={meta.further_information?.mockup_image_url} />
          </div>
        </CardContent>
      </Card>

      {/* Program Objectives */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Program Objectives Section</CardTitle>
            <ProgramObjectivesSheet brandId={brandId} initial={meta.program_objectives} onSaved={setMeta} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldView label="Eyebrow" value={meta.program_objectives?.eyebrow} />
            <FieldView label="Title" value={meta.program_objectives?.title} />
          </div>
          <div className="mt-3">
            <FieldView label="Intro Paragraph" value={meta.program_objectives?.intro} />
          </div>
          <div className="mt-3">
            <p className="text-xs font-medium text-zinc-500">Objective Items</p>
            {meta.program_objectives?.items && meta.program_objectives.items.length > 0 ? (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-900">
                {meta.program_objectives.items.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-0.5 text-sm text-zinc-400">
                No custom objective items set. Landing page will use active program objectives.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Moments Shorts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Moments Shorts (Video Section)</CardTitle>
            <MomentsShortsSheet brandId={brandId} initial={meta.moments_shorts} onSaved={setMeta} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldView label="Eyebrow" value={meta.moments_shorts?.eyebrow} />
            <FieldView label="Title" value={meta.moments_shorts?.title} />
            <FieldView label="Description" value={meta.moments_shorts?.description} />
          </div>
        </CardContent>
      </Card>

      {/* Partners Page — Canva Embed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Partners Page — Canva Embed</CardTitle>
            <PartnersCanvaSheet brandId={brandId} initial={meta.partners_canva_url ?? null} onSaved={setMeta} />
          </div>
        </CardHeader>
        <CardContent>
          {meta.partners_canva_url ? (
            <FieldView label="Canva Embed URL" value={
              <a href={meta.partners_canva_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline break-all">
                {meta.partners_canva_url}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            } />
          ) : (
            <p className="text-sm text-zinc-400">No Canva embed URL set. Add one to show a Canva presentation on the Partners &amp; Sponsors page.</p>
          )}
        </CardContent>
      </Card>

      {/* Partners Page — Affiliate Commission */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Partners Page — Affiliate Commission</CardTitle>
            <AffiliateCommissionSheet brandId={brandId} initial={meta.affiliateCommission ?? null} onSaved={setMeta} />
          </div>
        </CardHeader>
        <CardContent>
          {meta.affiliateCommission ? (
            <div className="grid grid-cols-2 gap-4">
              <FieldView label="Fully-funded %" value={`${meta.affiliateCommission.fullyFundedPct}%`} />
              <FieldView label="Self-funded %" value={`${meta.affiliateCommission.selfFundedPct}%`} />
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Using defaults (5% fully-funded, 20% self-funded). Set custom percentages to override.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentInfoSheet({
  brandId,
  initial,
  onSaved,
}: {
  brandId: string;
  initial: BrandPaymentInfo | undefined;
  onSaved: (updated: BrandMetadata) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BrandPaymentInfo>(normalizePaymentInfo(initial));

  function resetState() {
    setForm(normalizePaymentInfo(initial));
    setError(null);
  }

  function setField<K extends keyof BrandPaymentInfo>(key: K, value: BrandPaymentInfo[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function setItemField(index: number, key: keyof BrandPaymentInfoItem, value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
    setError(null);
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: `payment-item-${Date.now()}`,
          icon: "payment_schedule",
          title: "",
          body: "",
        },
      ],
    }));
    setError(null);
  }

  function removeItem(index: number) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const sanitizedItems = form.items.map((item, index) => ({
        id: item.id.trim() || `payment-item-${index + 1}`,
        icon: item.icon.trim() || "payment_schedule",
        title: item.title.trim(),
        body: item.body.trim(),
      }));

      const updated = await updatePlatformBrandMetadata(brandId, {
        payment_info: {
          eyebrow: form.eyebrow.trim(),
          title: form.title.trim(),
          introText: form.introText.trim(),
          items: sanitizedItems,
          note: form.note.trim(),
        },
      });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { resetState(); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Payment &amp; Selection Section</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <FieldInput label="Eyebrow" id="payment-info-eyebrow" value={form.eyebrow} onChange={(value) => setField("eyebrow", value)} />
            <FieldInput label="Title" id="payment-info-title" value={form.title} onChange={(value) => setField("title", value)} />
            <FieldTextarea label="Intro Text" id="payment-info-intro" value={form.introText} onChange={(value) => setField("introText", value)} rows={3} />

            <div className="space-y-3 border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Cards</p>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Card
                </Button>
              </div>

              {form.items.length === 0 ? (
                <p className="text-sm text-zinc-400">No cards configured.</p>
              ) : (
                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-zinc-500">Card {index + 1}</p>
                        <Button size="sm" variant="ghost" onClick={() => removeItem(index)}>
                          <X className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FieldInput label="ID" id={`payment-item-id-${index}`} value={item.id} onChange={(value) => setItemField(index, "id", value)} />
                        <FieldInput label="Icon key" id={`payment-item-icon-${index}`} value={item.icon} onChange={(value) => setItemField(index, "icon", value)} />
                      </div>
                      <FieldInput label="Card Title" id={`payment-item-title-${index}`} value={item.title} onChange={(value) => setItemField(index, "title", value)} />
                      <FieldTextarea label="Card Body" id={`payment-item-body-${index}`} value={item.body} onChange={(value) => setItemField(index, "body", value)} rows={3} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FieldTextarea label="Bottom Note" id="payment-info-note" value={form.note} onChange={(value) => setField("note", value)} rows={2} />
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Sheet: Partners Canva URL ─────────────────────────────────────────────

function PartnersCanvaSheet({
  brandId,
  initial,
  onSaved,
}: {
  brandId: string;
  initial: string | null;
  onSaved: (updated: BrandMetadata) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(initial ?? "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePlatformBrandMetadata(brandId, {
        partners_canva_url: url.trim() || null,
      });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setUrl(initial ?? ""); setError(null); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Partners Page Canva Embed</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="partners-canva-url">Canva Embed URL</Label>
              <Input
                id="partners-canva-url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(null); }}
                placeholder="https://www.canva.com/design/.../view?embed"
              />
              <p className="text-xs text-zinc-400">
                In Canva: <strong>Share → ··· → Embed → copy the URL inside <code>src="…"</code></strong>. It must end with <code>?embed</code>. The design must be set to <em>Anyone with the link can view</em>. Leave blank to hide the section.
              </p>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Sheet: Affiliate Commission ───────────────────────────────────────────

function AffiliateCommissionSheet({
  brandId,
  initial,
  onSaved,
}: {
  brandId: string;
  initial: { fullyFundedPct: number; selfFundedPct: number } | null;
  onSaved: (updated: BrandMetadata) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullyFunded, setFullyFunded] = useState(String(initial?.fullyFundedPct ?? ""));
  const [selfFunded, setSelfFunded] = useState(String(initial?.selfFundedPct ?? ""));

  function reset() {
    setFullyFunded(String(initial?.fullyFundedPct ?? ""));
    setSelfFunded(String(initial?.selfFundedPct ?? ""));
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const fullyTrim = fullyFunded.trim();
      const selfTrim = selfFunded.trim();

      // Both blank → clear the override (revert to defaults)
      if (!fullyTrim && !selfTrim) {
        const updated = await updatePlatformBrandMetadata(brandId, { affiliateCommission: null });
        onSaved(updated);
        setOpen(false);
        return;
      }

      const fullyNum = Number(fullyTrim);
      const selfNum = Number(selfTrim);
      const valid = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
      if (!valid(fullyNum) || !valid(selfNum)) {
        setError("Both percentages must be numbers between 0 and 100, or both blank to use defaults.");
        return;
      }

      const updated = await updatePlatformBrandMetadata(brandId, {
        affiliateCommission: { fullyFundedPct: fullyNum, selfFundedPct: selfNum },
      });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePlatformBrandMetadata(brandId, { affiliateCommission: null });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { reset(); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Affiliate Commission</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <p className="text-xs text-zinc-400">
              Percentages shown on the Partners page for the Affiliate Program tier. Leave both blank to use the platform defaults (5% fully-funded, 20% self-funded).
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="affiliate-fully-funded">Fully-funded %</Label>
              <Input
                id="affiliate-fully-funded"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={fullyFunded}
                onChange={(e) => { setFullyFunded(e.target.value); setError(null); }}
                placeholder="5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="affiliate-self-funded">Self-funded %</Label>
              <Input
                id="affiliate-self-funded"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={selfFunded}
                onChange={(e) => { setSelfFunded(e.target.value); setError(null); }}
                placeholder="20"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            {initial && (
              <Button variant="outline" onClick={handleClear} disabled={saving}>
                Reset to defaults
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Tab: Sponsors ────────────────────────────────────────────────────────────

const SPONSOR_TYPES = ["corporate", "ngo", "media_partner", "government", "academic", "individual", "other"];
const SPONSOR_TIERS = ["platinum", "gold", "silver", "bronze", "partner"];

type SponsorForm = {
  name: string;
  type: string;
  tier: string;
  websiteUrl: string;
  description: string;
  order: string;
  logo: File | null;
  logoPreview: string | null;
};

type SocialFeedForm = {
  permalink: string;
  isActive: boolean;
};

function toDatetimeLocal(value?: string | null): string {
  return value ? toLocalDatetimeInputValue(value) : "";
}

function formatFeedTimestamp(value: string): string {
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getFeedText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function buildInitialSocialFeedForm(feed?: BrandSocialFeed): SocialFeedForm {
  return {
    permalink: feed?.permalink ?? "",
    isActive: feed?.isActive ?? true,
  };
}

function SponsorSheet({
  brandId,
  sponsor,
  onSaved,
  trigger,
}: {
  brandId: string;
  sponsor?: BrandSponsor;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SponsorForm>({
    name: sponsor?.name ?? "",
    type: sponsor?.type ?? "corporate",
    tier: sponsor?.tier ?? "",
    websiteUrl: sponsor?.websiteUrl ?? "",
    description: sponsor?.description ?? "",
    order: String(sponsor?.order ?? 0),
    logo: null,
    logoPreview: sponsor?.logoUrl ?? null,
  });
  const [logoImgError, setLogoImgError] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [programs, setPrograms] = useState<PlatformProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const pendingLogoPreviewUrl = useMemo(
    () => (form.logo ? URL.createObjectURL(form.logo) : null),
    [form.logo],
  );

  useEffect(() => {
    return () => {
      if (pendingLogoPreviewUrl) {
        URL.revokeObjectURL(pendingLogoPreviewUrl);
      }
    };
  }, [pendingLogoPreviewUrl]);

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
        const result = await listProgramMedia({
          programId,
          brandId,
          limit: 100,
        });
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

  // Reset form state when sheet opens (handles re-open with stale data)
  function handleOpenChange(next: boolean) {
    if (next) {
      setForm({
        name: sponsor?.name ?? "",
        type: sponsor?.type ?? "corporate",
        tier: sponsor?.tier ?? "",
        websiteUrl: sponsor?.websiteUrl ?? "",
        description: sponsor?.description ?? "",
        order: String(sponsor?.order ?? 0),
        logo: null,
        logoPreview: sponsor?.logoUrl ?? null,
      });
      setLogoImgError(false);
      setError(null);
      setPickerOpen(false);
      setPrograms([]);
      setProgramsLoading(false);
      setProgramsError(null);
      setSelectedProgramId("");
      setFiles([]);
      setFilesLoading(false);
      setFilesError(null);
      setSearch("");
    } else {
      setPickerOpen(false);
    }
    setOpen(next);
  }

  function setField<K extends keyof SponsorForm>(k: K, v: SponsorForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setField("logo", file);
    setLogoImgError(false);
    if (!form.logoPreview && sponsor?.logoUrl) {
      setField("logoPreview", sponsor.logoUrl);
    }
    e.target.value = "";
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.type.trim()) { setError("Type is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const tier = form.tier.trim();
      const websiteUrl = form.websiteUrl.trim();
      const description = form.description.trim();
      const logoUrl = form.logo ? undefined : (form.logoPreview?.trim() || null);

      if (sponsor) {
        await updateBrandSponsor(brandId, sponsor.id, {
          name: form.name.trim(),
          type: form.type.trim(),
          tier: tier || null,
          websiteUrl: websiteUrl || null,
          description: description || null,
          order: parseInt(form.order, 10) || 0,
          logo: form.logo,
          logoUrl,
        });
      } else {
        await createBrandSponsor(brandId, {
          name: form.name.trim(),
          type: form.type.trim(),
          ...(tier ? { tier } : {}),
          ...(websiteUrl ? { websiteUrl } : {}),
          ...(description ? { description } : {}),
          order: parseInt(form.order, 10) || 0,
          logo: form.logo,
          ...(logoUrl ? { logoUrl } : {}),
        });
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = pendingLogoPreviewUrl ?? form.logoPreview ?? null;
  const hasValidPreview = previewUrl && !logoImgError;
  const visibleFiles = search.trim()
    ? files.filter((file) =>
        (file.original_filename || file.filename || "")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    : files;

  return (
    <>
      <span onClick={() => handleOpenChange(true)}>{trigger}</span>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{sponsor ? "Edit Sponsor" : "Add Sponsor"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="sp-name">Name *</Label>
              <Input id="sp-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Asia Innovation Fund" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sp-type">Type *</Label>
              <select
                id="sp-type"
                value={form.type}
                onChange={(e) => setField("type", e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                {SPONSOR_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sp-tier">Tier</Label>
              <select
                id="sp-tier"
                value={form.tier}
                onChange={(e) => setField("tier", e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">— None —</option>
                {SPONSOR_TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sp-url">Website URL</Label>
              <Input id="sp-url" value={form.websiteUrl} onChange={(e) => setField("websiteUrl", e.target.value)} placeholder="https://example.com" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sp-desc">Description</Label>
              <Input id="sp-desc" value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Short description (optional)" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sp-order">Display Order</Label>
              <Input id="sp-order" type="number" min={0} value={form.order} onChange={(e) => setField("order", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Logo</Label>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="group flex h-32 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 transition hover:border-blue-400 hover:bg-blue-50/30"
              >
                {hasValidPreview ? (
                  <div className="relative flex h-full w-full items-center justify-center p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl!}
                      alt="Logo preview"
                      className="max-h-full max-w-full object-contain"
                      onError={() => setLogoImgError(true)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/20">
                      <span className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-zinc-700 opacity-0 transition group-hover:opacity-100">
                        Change logo
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-zinc-400" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-zinc-700">
                        {form.logo ? form.logo.name : "Click to upload logo"}
                      </p>
                      <p className="text-xs text-zinc-500">PNG, JPG, WebP · Max 5MB</p>
                    </div>
                  </>
                )}
              </button>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" type="button" onClick={() => logoInputRef.current?.click()}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> Upload logo
                </Button>
                <Button size="sm" variant="outline" type="button" onClick={() => void openLibrary()}>
                  <Layers className="mr-1 h-3.5 w-3.5" /> Media library
                </Button>
                {(form.logo || form.logoPreview) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setField("logo", null);
                      setField("logoPreview", null);
                      setLogoImgError(false);
                    }}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Clear
                  </Button>
                ) : null}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onLogoChange}
              />
              {hasValidPreview && (
                <p className="text-xs text-zinc-500">
                  {form.logo ? `New: ${form.logo.name}` : "Current logo selected"}
                </p>
              )}
              <p className="text-xs text-zinc-400">
                Upload a new logo or choose one from a program media library for this brand.
              </p>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />{saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b border-zinc-200 px-6 py-4">
            <DialogTitle>Pick Sponsor Logo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 border-b border-zinc-200 bg-zinc-50/70 px-6 py-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="sponsor-program-picker">Program media library</Label>
                <select
                  id="sponsor-program-picker"
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
                <Label htmlFor="sponsor-logo-search">Search images</Label>
                <Input
                  id="sponsor-logo-search"
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
                No programs are available for this brand yet. Upload a new logo instead.
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
                        if (!url) {
                          return;
                        }

                        setField("logo", null);
                        setField("logoPreview", url);
                        setLogoImgError(false);
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
    </>
  );
}

function SponsorsTab({ brandId }: { brandId: string }) {
  const [sponsors, setSponsors] = useState<BrandSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    listBrandSponsors(brandId)
      .then(setSponsors)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load sponsors."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this sponsor? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteBrandSponsor(brandId, id);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">Loading sponsors…</div>;
  }
  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SponsorSheet brandId={brandId} onSaved={reload} trigger={
          <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Sponsor</Button>
        } />
      </div>
      {sponsors.length === 0 ? (
        <EmptyState title="No sponsors yet" description="Sponsors added to this brand will appear here." />
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Sponsor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Website</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sponsors.map((s) => (
                <tr key={s.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logoUrl} alt={s.name} className="h-7 w-7 rounded border border-zinc-200 object-contain" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
                          <ImageIcon className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900">{s.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span>Order {s.order}</span>
                          {s.description ? <span className="truncate max-w-[260px]">{s.description}</span> : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-600">{s.type.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    {s.tier ? <Badge variant="secondary">{s.tier}</Badge> : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.websiteUrl ? (
                      <a href={s.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        Visit <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <SponsorSheet brandId={brandId} sponsor={s} onSaved={reload} trigger={
                        <Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                      } />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(s.id)}
                        disabled={deletingId === s.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-zinc-200 px-4 py-2.5">
            <p className="text-xs text-zinc-400">{sponsors.length} sponsor{sponsors.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SocialFeedSheet({
  brandId,
  socialFeed,
  onSaved,
  trigger,
}: {
  brandId: string;
  socialFeed?: BrandSocialFeed;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SocialFeedForm>(buildInitialSocialFeedForm(socialFeed));

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(buildInitialSocialFeedForm(socialFeed));
      setError(null);
    }
    setOpen(next);
  }

  function setField<K extends keyof SocialFeedForm>(key: K, value: SocialFeedForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSave() {
    if (!form.permalink.trim()) {
      setError("Instagram post URL is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        permalink: form.permalink.trim(),
        isActive: form.isActive,
      };

      if (socialFeed) {
        await updateBrandSocialFeed(brandId, socialFeed.id, payload);
      } else {
        await createBrandSocialFeed(brandId, payload);
      }

      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <span onClick={() => handleOpenChange(true)}>{trigger}</span>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{socialFeed ? "Edit Social Feed" : "Add Social Feed"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <FieldInput
              label="Instagram Post URL"
              id="feed-permalink"
              value={form.permalink}
              onChange={(value) => setField("permalink", value)}
              placeholder="https://instagram.com/p/..."
              hint="Paste the Instagram post link or the full Instagram embed code. The system will extract the permalink and auto-fill preview metadata."
            />
            <FieldCheckbox
              label="Active on landing page"
              id="feed-active"
              checked={form.isActive}
              onChange={(value) => setField("isActive", value)}
              hint="Only active Instagram feed items are eligible for the landing page."
            />
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              <p className="font-medium text-zinc-800">What happens after save</p>
              <p className="mt-1">
                We normalize the pasted Instagram URL/embed snippet to an official post permalink, then derive the post
                ID and try to fetch preview metadata (image, caption, publish date). The landing page renders the
                official Instagram embed from this permalink. If the embed or preview image cannot load, the landing
                page still shows a safe fallback card linking to the post.
              </p>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />{saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SocialFeedsTab({ brandId }: { brandId: string }) {
  const [feeds, setFeeds] = useState<BrandSocialFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listBrandSocialFeeds(brandId)
      .then(setFeeds)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load social feeds."))
      .finally(() => setLoading(false));
  }, [brandId]);

  useEffect(() => {
    let cancelled = false;

    listBrandSocialFeeds(brandId)
      .then((items) => {
        if (!cancelled) {
          setFeeds(items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load social feeds.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [brandId]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this social feed item? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteBrandSocialFeed(brandId, id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">Loading social feeds…</div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          Manage the Instagram posts shown in the registration overview on the main landing page. The latest active post appears first, and up to 6 posts are loaded.
        </p>
        <SocialFeedSheet
          brandId={brandId}
          onSaved={load}
          trigger={<Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Feed Item</Button>}
        />
      </div>
      {feeds.length === 0 ? (
        <EmptyState title="No social feeds yet" description="Instagram feed items added here will be available to the landing page." />
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Post</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Posted</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Link</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {feeds.map((feed) => (
                <tr key={feed.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
                        {feed.imageUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={feed.imageUrl} alt={feed.caption ?? "Instagram feed image"} className="h-full w-full object-cover" />
                          </>
                        ) : (
                          <ImageIcon className="h-4 w-4 text-zinc-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-900">{getFeedText(feed.postId, "Untitled post")}</p>
                        <p className="line-clamp-2 text-xs text-zinc-500">
                          {getFeedText(feed.caption, "No caption")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{formatFeedTimestamp(feed.postedAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={feed.isActive ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={feed.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      Open post <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <SocialFeedSheet
                        brandId={brandId}
                        socialFeed={feed}
                        onSaved={load}
                        trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(feed.id)}
                        disabled={deletingId === feed.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-zinc-200 px-4 py-2.5">
            <p className="text-xs text-zinc-400">{feeds.length} feed item{feeds.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Admins ──────────────────────────────────────────────────────────────

function AssignAdminSheet({
  brandId,
  assignedAdminIds,
  onSaved,
}: {
  brandId: string;
  assignedAdminIds: string[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [allOptions, setAllOptions] = useState<AdminOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selected, setSelected] = useState<AdminOption | null>(null);
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter at render time so it always uses the latest assignedAdminIds prop
  const options = allOptions.filter((a) => !assignedAdminIds.includes(a.id));

  useEffect(() => {
    if (!open) return;
    setLoadingOptions(true);
    listAllAdmins(search || undefined)
      .then((res) => setAllOptions(res.data))
      .catch(() => setAllOptions([]))
      .finally(() => setLoadingOptions(false));
  }, [open, search]);

  async function handleAssign() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await assignBrandAdmin(brandId, { adminId: selected.id, roleInBrand: role || undefined });
      setOpen(false);
      setSelected(null);
      setRole("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign admin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => { setOpen(true); setError(null); setSelected(null); setRole(""); setSearch(""); }}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Assign Admin
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Assign Admin</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <div className="space-y-1.5">
              <Label>Search Admin</Label>
              <Input
                placeholder="Name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {loadingOptions ? (
              <p className="text-xs text-zinc-400">Loading…</p>
            ) : (
              <div className="max-h-52 overflow-y-auto rounded-lg border border-zinc-200">
                {options.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-zinc-400 text-center">No admins found.</p>
                ) : (
                  options.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelected(a)}
                      className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-zinc-50 ${selected?.id === a.id ? "bg-blue-50" : ""}`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900 truncate">{a.fullName}</p>
                        <p className="text-xs text-zinc-400 truncate">{a.email}</p>
                      </div>
                      {selected?.id === a.id && <span className="ml-auto text-blue-600 text-xs font-medium shrink-0">Selected</span>}
                    </button>
                  ))
                )}
              </div>
            )}
            {selected && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                <p className="font-medium text-blue-800">{selected.fullName}</p>
                <p className="text-xs text-blue-600">{selected.email}</p>
              </div>
            )}
            <FieldInput label="Role (optional)" id="role" value={role} onChange={setRole} placeholder="e.g. admin, editor" />
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleAssign} loading={saving} disabled={saving || !selected}>
              <Save className="mr-1.5 h-4 w-4" /> Assign
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function AdminsTab({ brandId }: { brandId: string }) {
  const [admins, setAdmins] = useState<BrandAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listBrandAdmins(brandId)
      .then(setAdmins)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load admins."))
      .finally(() => setLoading(false));
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  async function handleRemove(adminId: string) {
    setRemoving(adminId);
    try {
      await removeBrandAdmin(brandId, adminId);
      load();
    } catch {
      // silently reload; table will show current state
    } finally {
      setRemoving(null);
    }
  }

  if (loading) return <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">Loading admins…</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <AssignAdminSheet
          brandId={brandId}
          assignedAdminIds={admins.map((a) => a.adminId)}
          onSaved={load}
        />
      </div>
      {admins.length === 0 ? (
        <EmptyState
          title="No admins assigned"
          description="Assign admins to give them access to this brand."
          action={{ label: "Assign Admin", onClick: () => {} }}
        />
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Assigned</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{a.admin?.fullName ?? a.adminId}</p>
                    {a.admin?.user?.email && <p className="text-xs text-zinc-400">{a.admin.user.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {a.roleInBrand ? <Badge variant="secondary" className="capitalize">{a.roleInBrand}</Badge> : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(a.assignedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      loading={removing === a.id}
                      disabled={removing === a.id}
                      onClick={() => handleRemove(a.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-zinc-200 px-4 py-2.5">
            <p className="text-xs text-zinc-400">{admins.length} admin{admins.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Email Templates ─────────────────────────────────────────────────────

function EmailTemplateSheet({
  brandId,
  template,
  onSaved,
  onClose,
}: {
  brandId: string;
  template: EmailTemplate | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const isEdit = !!template;
  const [form, setForm] = useState({
    name: template?.name ?? "",
    type: template?.type ?? "",
    subject: template?.subject ?? "",
    body: template?.body ?? "",
    isActive: template?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null); setSuccess(null);
  }

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(null);
    try {
      if (isEdit) {
        await updateEmailTemplate(template!.id, { name: form.name, type: form.type, subject: form.subject, body: form.body, isActive: form.isActive });
      } else {
        await createEmailTemplate({ name: form.name, type: form.type, subject: form.subject, body: form.body, brandId, isActive: form.isActive });
      }
      setSuccess(isEdit ? "Template updated." : "Template created.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{isEdit ? "Edit Template" : "New Template"}</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-4">
          <SheetMsg message={error} variant="error" />
          <SheetMsg message={success} variant="success" />
          <FieldInput label="Name" id="et-name" value={form.name} onChange={(v) => set("name", v)} placeholder="Application Received" />
          <FieldInput label="Type" id="et-type" value={form.type} onChange={(v) => set("type", v)} placeholder="application_received" hint="Unique identifier used to trigger this template" />
          <FieldInput label="Subject" id="et-subject" value={form.subject} onChange={(v) => set("subject", v)} placeholder="Your application for {{program_name}} has been received" />
          <FieldTextarea label="Body (HTML)" id="et-body" value={form.body} onChange={(v) => set("body", v)} rows={10} placeholder="<p>Dear {{name}},</p>..." />
          <FieldCheckbox label="Active" id="et-active" checked={form.isActive} onChange={(v) => set("isActive", v)} hint="Inactive templates will not be sent" />
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" /> {isEdit ? "Update" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function EmailTemplatesTab({ brandId }: { brandId: string }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetTarget, setSheetTarget] = useState<EmailTemplate | null | "new">(undefined as unknown as null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listEmailTemplates({ brandId })
      .then(setTemplates)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load templates."))
      .finally(() => setLoading(false));
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    setDeleting(id);
    try { await deleteEmailTemplate(id); load(); } catch { /* ignore */ } finally { setDeleting(null); }
  }

  if (loading) return <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">Loading templates…</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  return (
    <>
      {sheetTarget !== undefined && sheetTarget !== null && (
        <EmailTemplateSheet
          brandId={brandId}
          template={sheetTarget === "new" ? null : sheetTarget}
          onSaved={() => { setSheetTarget(undefined as unknown as null); load(); }}
          onClose={() => setSheetTarget(undefined as unknown as null)}
        />
      )}
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setSheetTarget("new")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Template
          </Button>
        </div>
        {templates.length === 0 ? (
          <EmptyState
            title="No email templates"
            description="Create templates to automate emails for this brand."
            action={{ label: "New Template", onClick: () => setSheetTarget("new") }}
          />
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900">{t.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-mono text-xs">{t.type}</Badge>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-zinc-600">{t.subject}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.isActive ? "success" : "secondary"}>{t.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setSheetTarget(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          loading={deleting === t.id}
                          disabled={deleting === t.id}
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-zinc-200 px-4 py-2.5">
              <p className="text-xs text-zinc-400">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Tab: Legal Docs ──────────────────────────────────────────────────────────

function LegalDocSheet({
  brandSlug,
  doc,
  onSaved,
  onClose,
}: {
  brandSlug: string;
  doc: LegalDocument | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const isEdit = !!doc;
  const [form, setForm] = useState({
    title: doc?.title ?? "",
    slug: doc?.slug ?? "",
    content: doc?.content ?? "",
    version: doc?.version ?? "1.0",
    description: doc?.description ?? "",
    isRequired: doc?.isRequired ?? false,
    isActive: doc?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null); setSuccess(null);
  }

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(null);
    try {
      if (isEdit) {
        await updateLegalDocument(brandSlug, doc!.id, {
          title: form.title, slug: form.slug, content: form.content,
          version: form.version, description: form.description || undefined,
          isRequired: form.isRequired, isActive: form.isActive,
        });
      } else {
        await createLegalDocument(brandSlug, {
          title: form.title, slug: form.slug, content: form.content,
          version: form.version, description: form.description || undefined,
          isRequired: form.isRequired, isActive: form.isActive,
        });
      }
      setSuccess(isEdit ? "Document updated." : "Document created.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{isEdit ? "Edit Document" : "New Document"}</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-4">
          <SheetMsg message={error} variant="error" />
          <SheetMsg message={success} variant="success" />
          <FieldInput label="Title" id="ld-title" value={form.title} onChange={(v) => set("title", v)} placeholder="Privacy Policy" />
          <FieldInput label="Slug" id="ld-slug" value={form.slug} onChange={(v) => set("slug", v)} placeholder="privacy-policy" hint="URL-friendly identifier" />
          <FieldInput label="Version" id="ld-version" value={form.version} onChange={(v) => set("version", v)} placeholder="1.0" />
          <FieldInput label="Description" id="ld-desc" value={form.description} onChange={(v) => set("description", v)} placeholder="Short description" />
          <FieldTextarea label="Content (HTML/Markdown)" id="ld-content" value={form.content} onChange={(v) => set("content", v)} rows={12} placeholder="<p>Your privacy policy content...</p>" />
          <FieldCheckbox label="Required" id="ld-required" checked={form.isRequired} onChange={(v) => set("isRequired", v)} hint="Users must accept this document to proceed" />
          <FieldCheckbox label="Active" id="ld-active" checked={form.isActive} onChange={(v) => set("isActive", v)} hint="Inactive documents are hidden from public view" />
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" /> {isEdit ? "Update" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function LegalDocsTab({ brandSlug }: { brandSlug: string }) {
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetTarget, setSheetTarget] = useState<LegalDocument | null | "new">(undefined as unknown as null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listLegalDocuments(brandSlug)
      .then(setDocs)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load documents."))
      .finally(() => setLoading(false));
  }, [brandSlug]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    setDeleting(id);
    try { await deleteLegalDocument(brandSlug, id); load(); } catch { /* ignore */ } finally { setDeleting(null); }
  }

  if (loading) return <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">Loading documents…</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  return (
    <>
      {sheetTarget !== undefined && sheetTarget !== null && (
        <LegalDocSheet
          brandSlug={brandSlug}
          doc={sheetTarget === "new" ? null : sheetTarget}
          onSaved={() => { setSheetTarget(undefined as unknown as null); load(); }}
          onClose={() => setSheetTarget(undefined as unknown as null)}
        />
      )}
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setSheetTarget("new")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Document
          </Button>
        </div>
        {docs.length === 0 ? (
          <EmptyState
            title="No legal documents"
            description="Add privacy policies, terms of service, and other legal documents for this brand."
            action={{ label: "New Document", onClick: () => setSheetTarget("new") }}
          />
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Slug</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Required</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900">{d.title}</td>
                    <td className="px-4 py-3"><span className="font-mono text-xs text-zinc-500">{d.slug}</span></td>
                    <td className="px-4 py-3 text-zinc-600">{d.version}</td>
                    <td className="px-4 py-3">
                      <Badge variant={d.isRequired ? "warning" : "secondary"}>{d.isRequired ? "Required" : "Optional"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={d.isActive ? "success" : "secondary"}>{d.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setSheetTarget(d)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          loading={deleting === d.id}
                          disabled={deleting === d.id}
                          onClick={() => handleDelete(d.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-zinc-200 px-4 py-2.5">
              <p className="text-xs text-zinc-400">{docs.length} document{docs.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Info Strip ───────────────────────────────────────────────────────────────

function InfoStrip({ brand }: { brand: PlatformBrandDetail }) {
  const parts: string[] = [];
  if (brand.defaultCurrency) parts.push(brand.defaultCurrency);
  if (brand.defaultCountry) parts.push(brand.defaultCountry);
  if (brand.defaultTimezone) parts.push(brand.defaultTimezone);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-500">
      <StatusBadge status={brand.isActive ? "active" : "inactive"} context="generic" />
      <span className="text-zinc-300">·</span>
      <span>{brand.programCount ?? 0} programs</span>
      {parts.length > 0 && (
        <>
          <span className="text-zinc-300">·</span>
          <span>{parts.join(" · ")}</span>
        </>
      )}
      <span className="text-zinc-300">·</span>
      <span>Created {formatDate(brand.createdAt)}</span>
    </div>
  );
}

function BrandDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-4 w-28" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-7 w-64 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      <Skeleton className="h-10 w-full rounded-lg" />

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-24 rounded-md" />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BrandDetailPage({ brandId }: { brandId: string }) {
  const [brand, setBrand] = useState<PlatformBrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((silent = false) => {
    getPlatformBrand(brandId)
      .then((data) => {
        setError(null);
        setBrand(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load brand."))
      .finally(() => { if (!silent) setLoading(false); });
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <BrandDetailSkeleton />;
  }

  if (error || !brand) {
    return (
      <div className="space-y-4">
        <Link
          href="/platform/brands"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Brands
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Brand not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1">
            <Link
              href="/platform/brands"
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Brands
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt={`${brand.name} logo`} className="h-full w-full object-contain p-1" />
              ) : (
                <ImageIcon className="h-5 w-5 text-zinc-300" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-zinc-900">{brand.name}</h1>
              {(brand.description || brand.slug) && (
                <p className="mt-0.5 truncate text-sm text-zinc-500">{brand.description ?? brand.slug}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <IdentitySheet brand={brand} onSaved={() => load(true)} />
        </div>
      </div>

      <InfoStrip brand={brand} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contact">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="landing">Landing Page</TabsTrigger>
          <TabsTrigger value="programs">
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            Programs
          </TabsTrigger>
          <TabsTrigger value="social-feeds">Social Feeds</TabsTrigger>
          <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
          <TabsTrigger value="admins">Admins</TabsTrigger>
          <TabsTrigger value="email-templates">Email Templates</TabsTrigger>
          <TabsTrigger value="legal-docs">Legal Docs</TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab brand={brand} onSaved={() => load(true)} />
        </TabsContent>
        <TabsContent value="contact" className="mt-4">
          <ContactTab brand={brand} onSaved={() => load(true)} />
        </TabsContent>
        <TabsContent value="landing" className="mt-4">
          <LandingPageTab brandId={brandId} />
        </TabsContent>
        <TabsContent value="programs" className="mt-4">
          <ProgramsTab brandId={brandId} />
        </TabsContent>
        <TabsContent value="social-feeds" className="mt-4">
          <SocialFeedsTab brandId={brandId} />
        </TabsContent>
        <TabsContent value="sponsors" className="mt-4">
          <SponsorsTab brandId={brandId} />
        </TabsContent>
        <TabsContent value="admins" className="mt-4">
          <AdminsTab brandId={brandId} />
        </TabsContent>
        <TabsContent value="email-templates" className="mt-4">
          <EmailTemplatesTab brandId={brandId} />
        </TabsContent>
        <TabsContent value="legal-docs" className="mt-4">
          <LegalDocsTab brandSlug={brand.slug} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab brand={brand} onSaved={() => load(true)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
