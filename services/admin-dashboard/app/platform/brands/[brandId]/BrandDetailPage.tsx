"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
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
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";
import { StatusBadge } from "@/src/admin/status-badge";
import { EmptyState } from "@/src/admin/empty-state";
import { Button } from "@/src/ui/button";
import { Badge } from "@/src/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import {
  getPlatformBrand,
  listPlatformPrograms,
  listBrandSponsors,
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
  type AdminOption,
  type BrandAdmin,
  type BrandSponsor,
  type EmailTemplate,
  type LegalDocument,
  type PlatformBrandDetail,
  type PlatformProgram,
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
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: brand.name ?? "",
    slug: brand.slug ?? "",
    description: brand.description ?? "",
    websiteUrl: brand.websiteUrl ?? "",
    primaryColor: brand.primaryColor ?? "",
    contactEmail: brand.contactEmail ?? "",
    isActive: brand.isActive ?? true,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
    setSuccess(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updatePlatformBrandIdentity(brand.id, {
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        websiteUrl: form.websiteUrl || undefined,
        primaryColor: form.primaryColor || undefined,
        contactEmail: form.contactEmail || undefined,
        isActive: form.isActive,
      });
      setSuccess("Identity saved.");
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
            <FieldInput label="Name" id="name" value={form.name} onChange={(v) => set("name", v)} placeholder="Brand name" />
            <FieldInput label="Slug" id="slug" value={form.slug} onChange={(v) => set("slug", v)} placeholder="brand-slug" hint="URL-friendly identifier" />
            <FieldTextarea label="Description" id="description" value={form.description} onChange={(v) => set("description", v)} placeholder="Short description" rows={3} />
            <FieldInput label="Website URL" id="websiteUrl" value={form.websiteUrl} onChange={(v) => set("websiteUrl", v)} placeholder="https://example.com" />
            <FieldInput label="Primary Color" id="primaryColor" value={form.primaryColor} onChange={(v) => set("primaryColor", v)} placeholder="#1a2b3c" hint="Hex color code" />
            <FieldInput label="Contact Email" id="contactEmail" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} type="email" placeholder="contact@brand.com" />
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
    requireEmailVerification: brand.requireEmailVerification ?? false,
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
        requireEmailVerification: form.requireEmailVerification,
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
        metaKeywords: form.metaKeywords || undefined,
      });
      setSuccess("Details saved.");
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
            <FieldTextarea label="About" id="about" value={form.about} onChange={(v) => set("about", v)} rows={4} />
            <FieldTextarea label="Vision" id="vision" value={form.vision} onChange={(v) => set("vision", v)} rows={3} />
            <FieldTextarea label="Mission" id="mission" value={form.mission} onChange={(v) => set("mission", v)} rows={3} />
            <FieldInput label="Default Location" id="defaultLocation" value={form.defaultLocation} onChange={(v) => set("defaultLocation", v)} placeholder="Jakarta, Indonesia" />
            <FieldInput label="Default Country" id="defaultCountry" value={form.defaultCountry} onChange={(v) => set("defaultCountry", v)} placeholder="ID" />
            <FieldInput label="Default Timezone" id="defaultTimezone" value={form.defaultTimezone} onChange={(v) => set("defaultTimezone", v)} placeholder="Asia/Jakarta" />
            <FieldCheckbox label="Require Email Verification" id="requireEmailVerification" checked={form.requireEmailVerification} onChange={(v) => set("requireEmailVerification", v)} />
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
        contactPhone: form.contactPhone || undefined,
        contactWhatsapp: form.contactWhatsapp || undefined,
        contactAddress: form.contactAddress || undefined,
        socialMediaLinks: Object.keys(socialMediaLinks).length > 0 ? socialMediaLinks : undefined,
      });
      setSuccess("Contact saved.");
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
          <SheetHeader><SheetTitle>Edit Contact</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <SheetMsg message={success} variant="success" />
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
      setSuccess("Settings saved.");
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
      {(brand.bannerUrl || brand.logoUrl) && (
        <Card className="overflow-hidden">
          {brand.bannerUrl && (
            <div className="relative h-36 w-full bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.bannerUrl} alt="Brand banner" className="h-full w-full object-cover" />
            </div>
          )}
          {brand.logoUrl && (
            <CardContent className="flex items-center gap-4 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logoUrl} alt={`${brand.name} logo`} className="h-14 w-14 rounded-lg border border-zinc-200 object-contain p-1" />
              <div>
                <p className="text-xs text-zinc-500">Logo</p>
                <a href={brand.logoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Section
        title="About"
        action={<DetailsSheet brand={brand} onSaved={onSaved} />}
      >
        {brand.about ? (
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-zinc-500">About</p>
            <p className="mt-0.5 text-sm text-zinc-900 whitespace-pre-wrap">{brand.about}</p>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 sm:col-span-2">No description added yet.</p>
        )}
        {brand.vision && (
          <div>
            <p className="text-xs font-medium text-zinc-500">Vision</p>
            <p className="mt-0.5 text-sm text-zinc-900 whitespace-pre-wrap">{brand.vision}</p>
          </div>
        )}
        {brand.mission && (
          <div>
            <p className="text-xs font-medium text-zinc-500">Mission</p>
            <p className="mt-0.5 text-sm text-zinc-900 whitespace-pre-wrap">{brand.mission}</p>
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
    setLoading(true);
    listPlatformPrograms({ brandId, limit: 100 })
      .then((res) => {
        if (mounted) setPrograms(res.data);
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
                {new Date(p.applicationDeadline).toLocaleDateString()}
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

// ─── Tab: Sponsors ────────────────────────────────────────────────────────────

function SponsorsTab({ brandId }: { brandId: string }) {
  const [sponsors, setSponsors] = useState<BrandSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listBrandSponsors(brandId)
      .then((data) => { if (mounted) setSponsors(data); })
      .catch((err) => { if (mounted) setError(err instanceof Error ? err.message : "Failed to load sponsors."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [brandId]);

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">Loading sponsors…</div>;
  }
  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }
  if (sponsors.length === 0) {
    return (
      <EmptyState
        title="No sponsors yet"
        description="Sponsors added to this brand will appear here."
      />
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100">
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Sponsor</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Tier</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Website</th>
          </tr>
        </thead>
        <tbody>
          {sponsors.map((s) => (
            <tr key={s.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {s.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logoUrl} alt={s.name} className="h-7 w-7 rounded border border-zinc-200 object-contain" />
                  )}
                  <p className="font-medium text-zinc-900">{s.name}</p>
                </div>
              </td>
              <td className="px-4 py-3 text-zinc-600 capitalize">{s.type}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-zinc-200 px-4 py-2.5">
        <p className="text-xs text-zinc-400">{sponsors.length} sponsor{sponsors.length !== 1 ? "s" : ""}</p>
      </div>
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
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(a.assignedAt).toLocaleDateString()}</td>
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
      <span>Created {new Date(brand.createdAt).toLocaleDateString()}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BrandDetailPage({ brandId }: { brandId: string }) {
  const [brand, setBrand] = useState<PlatformBrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPlatformBrand(brandId)
      .then(setBrand)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load brand."))
      .finally(() => setLoading(false));
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center text-sm text-zinc-500">
        Loading brand…
      </div>
    );
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
      <PageHeader
        title={brand.name}
        description={brand.description ?? brand.slug}
        breadcrumb={
          <Link
            href="/platform/brands"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Brands
          </Link>
        }
        actions={<IdentitySheet brand={brand} onSaved={load} />}
      />

      <InfoStrip brand={brand} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contact">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="programs">
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            Programs
          </TabsTrigger>
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
          <OverviewTab brand={brand} onSaved={load} />
        </TabsContent>
        <TabsContent value="contact" className="mt-4">
          <ContactTab brand={brand} onSaved={load} />
        </TabsContent>
        <TabsContent value="programs" className="mt-4">
          <ProgramsTab brandId={brandId} />
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
          <SettingsTab brand={brand} onSaved={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
