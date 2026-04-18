"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import {
  getPlatformBrand,
  updatePlatformBrandDetails,
  updatePlatformBrandIdentity,
  updatePlatformBrandSettings,
  type PlatformBrandDetail,
} from "../../../api";

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function TextArea({
  label,
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

function CheckboxField({
  label,
  id,
  checked,
  onChange,
  hint,
}: {
  label: string;
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-blue-600"
      />
      <div>
        <Label htmlFor={id} className="cursor-pointer">{label}</Label>
        {hint && <p className="text-xs text-zinc-400">{hint}</p>}
      </div>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

function FormSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {message}
    </div>
  );
}

function SaveBar({
  saving,
  error,
  success,
}: {
  saving: boolean;
  error: string | null;
  success: string | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 pr-4">
        <FormError message={error} />
        <FormSuccess message={success} />
      </div>
      <Button type="submit" loading={saving} disabled={saving}>
        <Save className="mr-2 h-4 w-4" />
        Save
      </Button>
    </div>
  );
}

// ─── Tab: Identity ────────────────────────────────────────────────────────────

function IdentityTab({
  brand,
  onSaved,
}: {
  brand: PlatformBrandDetail;
  onSaved: (updated: PlatformBrandDetail) => void;
}) {
  const [name, setName] = useState(brand.name);
  const [slug, setSlug] = useState(brand.slug);
  const [description, setDescription] = useState(brand.description ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(brand.websiteUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(brand.primaryColor ?? "");
  const [contactEmail, setContactEmail] = useState(
    (brand as PlatformBrandDetail & { contactEmail?: string }).contactEmail ?? "",
  );
  const [isActive, setIsActive] = useState(brand.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updatePlatformBrandIdentity(brand.id, {
        name,
        slug,
        description: description || undefined,
        websiteUrl: websiteUrl || undefined,
        primaryColor: primaryColor || undefined,
        contactEmail: contactEmail || undefined,
        isActive,
      });
      setSuccess("Identity saved.");
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" id="name" value={name} onChange={setName} placeholder="YBB Foundation" />
          <Field
            label="Slug"
            id="slug"
            value={slug}
            onChange={setSlug}
            placeholder="ybb-foundation"
            hint="Used in URLs. Lowercase, hyphens only."
          />
          <div className="sm:col-span-2">
            <TextArea
              label="Description"
              id="description"
              value={description}
              onChange={setDescription}
              placeholder="Short description of this brand…"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Appearance & Web</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Website URL"
            id="websiteUrl"
            value={websiteUrl}
            onChange={setWebsiteUrl}
            placeholder="https://example.com"
          />
          <div className="space-y-1.5">
            <Label htmlFor="primaryColor">Primary Color</Label>
            <div className="flex items-center gap-2">
              <input
                id="primaryColor-picker"
                type="color"
                value={primaryColor || "#000000"}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border border-zinc-200 bg-white p-0.5"
              />
              <Input
                id="primaryColor"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#000000"
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact & Status</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Contact Email"
            id="contactEmail"
            value={contactEmail}
            onChange={setContactEmail}
            type="email"
            placeholder="contact@example.com"
          />
          <div className="flex items-end">
            <CheckboxField
              label="Brand is Active"
              id="isActive"
              checked={isActive}
              onChange={setIsActive}
              hint="Inactive brands are hidden from the platform."
            />
          </div>
        </CardContent>
      </Card>

      <SaveBar saving={saving} error={error} success={success} />
    </form>
  );
}

// ─── Tab: Details ─────────────────────────────────────────────────────────────

function DetailsTab({
  brand,
  onSaved,
}: {
  brand: PlatformBrandDetail;
  onSaved: (updated: PlatformBrandDetail) => void;
}) {
  const [about, setAbout] = useState(brand.about ?? "");
  const [vision, setVision] = useState(brand.vision ?? "");
  const [mission, setMission] = useState(brand.mission ?? "");
  const [contactPhone, setContactPhone] = useState(brand.contactPhone ?? "");
  const [contactWhatsapp, setContactWhatsapp] = useState(brand.contactWhatsapp ?? "");
  const [contactAddress, setContactAddress] = useState(brand.contactAddress ?? "");
  const [defaultLocation, setDefaultLocation] = useState(brand.defaultLocation ?? "");
  const [defaultCountry, setDefaultCountry] = useState(brand.defaultCountry ?? "");
  const [defaultTimezone, setDefaultTimezone] = useState(brand.defaultTimezone ?? "");
  const [metaTitle, setMetaTitle] = useState(brand.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(brand.metaDescription ?? "");
  const [metaKeywords, setMetaKeywords] = useState(brand.metaKeywords ?? "");
  // Social media as editable key-value pairs
  const [socialEntries, setSocialEntries] = useState<Array<{ platform: string; url: string }>>(
    Object.entries(brand.socialMediaLinks ?? {}).map(([platform, url]) => ({ platform, url })),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function addSocialEntry() {
    setSocialEntries((prev) => [...prev, { platform: "", url: "" }]);
  }

  function removeSocialEntry(index: number) {
    setSocialEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSocialEntry(index: number, key: "platform" | "url", value: string) {
    setSocialEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const socialMediaLinks = Object.fromEntries(
      socialEntries
        .filter((e) => e.platform.trim() && e.url.trim())
        .map((e) => [e.platform.trim().toLowerCase(), e.url.trim()]),
    );

    try {
      const updated = await updatePlatformBrandDetails(brand.id, {
        about: about || undefined,
        vision: vision || undefined,
        mission: mission || undefined,
        contactPhone: contactPhone || undefined,
        contactWhatsapp: contactWhatsapp || undefined,
        contactAddress: contactAddress || undefined,
        socialMediaLinks: Object.keys(socialMediaLinks).length > 0 ? socialMediaLinks : undefined,
        defaultLocation: defaultLocation || undefined,
        defaultCountry: defaultCountry || undefined,
        defaultTimezone: defaultTimezone || undefined,
        metaTitle: metaTitle || undefined,
        metaDescription: metaDescription || undefined,
        metaKeywords: metaKeywords || undefined,
      });
      setSuccess("Details saved.");
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>About</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <TextArea label="About" id="about" value={about} onChange={setAbout} rows={4} placeholder="Who is this brand?" />
          <TextArea label="Vision" id="vision" value={vision} onChange={setVision} rows={3} placeholder="Long-term vision…" />
          <TextArea label="Mission" id="mission" value={mission} onChange={setMission} rows={3} placeholder="What does this brand do…" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" id="contactPhone" value={contactPhone} onChange={setContactPhone} type="tel" placeholder="+62 812 0000 0000" />
          <Field label="WhatsApp" id="contactWhatsapp" value={contactWhatsapp} onChange={setContactWhatsapp} type="tel" placeholder="+62 812 0000 0000" />
          <div className="sm:col-span-2">
            <TextArea label="Address" id="contactAddress" value={contactAddress} onChange={setContactAddress} rows={2} placeholder="Street, City, Country…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Social Media</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addSocialEntry}>
              + Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {socialEntries.length === 0 && (
            <p className="text-sm text-zinc-400">No social media links. Click Add to start.</p>
          )}
          {socialEntries.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={entry.platform}
                onChange={(e) => updateSocialEntry(i, "platform", e.target.value)}
                placeholder="instagram"
                className="w-36 shrink-0 font-mono text-xs"
              />
              <Input
                value={entry.url}
                onChange={(e) => updateSocialEntry(i, "url", e.target.value)}
                placeholder="https://instagram.com/…"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-zinc-400 hover:text-red-600"
                onClick={() => removeSocialEntry(i)}
              >
                ×
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Location &amp; Locale</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Default Location" id="defaultLocation" value={defaultLocation} onChange={setDefaultLocation} placeholder="Jakarta" />
          <Field label="Default Country" id="defaultCountry" value={defaultCountry} onChange={setDefaultCountry} placeholder="Indonesia" />
          <Field label="Default Timezone" id="defaultTimezone" value={defaultTimezone} onChange={setDefaultTimezone} placeholder="Asia/Jakarta" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Meta Title" id="metaTitle" value={metaTitle} onChange={setMetaTitle} placeholder="Page title for SEO" />
          <TextArea label="Meta Description" id="metaDescription" value={metaDescription} onChange={setMetaDescription} rows={2} placeholder="Short description for search engines…" />
          <Field label="Meta Keywords" id="metaKeywords" value={metaKeywords} onChange={setMetaKeywords} placeholder="keyword1, keyword2, keyword3" hint="Comma-separated" />
        </CardContent>
      </Card>

      <SaveBar saving={saving} error={error} success={success} />
    </form>
  );
}

// ─── Tab: Settings ────────────────────────────────────────────────────────────

function SettingsTab({
  brand,
  onSaved,
}: {
  brand: PlatformBrandDetail;
  onSaved: (updated: PlatformBrandDetail) => void;
}) {
  const s = brand.settings;
  const [requireEmailVerification, setRequireEmailVerification] = useState(
    brand.requireEmailVerification ?? true,
  );
  const [defaultCurrency, setDefaultCurrency] = useState(brand.defaultCurrency ?? "USD");
  const [enableMultiCurrency, setEnableMultiCurrency] = useState(brand.enableMultiCurrency ?? false);
  const [usdInIdr, setUsdInIdr] = useState(String(s?.usdInIdr ?? 16000));
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(s?.isMaintenanceMode ?? false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(s?.maintenanceMessage ?? "");
  const [supportEmail, setSupportEmail] = useState(s?.supportEmail ?? "");
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(s?.googleAnalyticsId ?? "");
  const [pixelId, setPixelId] = useState(s?.pixelId ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updatePlatformBrandSettings(brand.id, {
        requireEmailVerification,
        defaultCurrency,
        enableMultiCurrency,
        usdInIdr: Number(usdInIdr),
        isMaintenanceMode,
        maintenanceMessage: maintenanceMessage || undefined,
        supportEmail: supportEmail || undefined,
        googleAnalyticsId: googleAnalyticsId || undefined,
        pixelId: pixelId || undefined,
      });
      setSuccess("Settings saved.");
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Currency</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Default Currency"
            id="defaultCurrency"
            value={defaultCurrency}
            onChange={setDefaultCurrency}
            placeholder="USD"
            hint="3-letter ISO code, e.g. USD, IDR"
          />
          <Field
            label="USD → IDR Rate"
            id="usdInIdr"
            value={usdInIdr}
            onChange={setUsdInIdr}
            type="number"
            placeholder="16000"
          />
          <CheckboxField
            label="Enable Multi-Currency"
            id="enableMultiCurrency"
            checked={enableMultiCurrency}
            onChange={setEnableMultiCurrency}
            hint="Allow participants to pay in multiple currencies."
          />
          <CheckboxField
            label="Require Email Verification"
            id="requireEmailVerification"
            checked={requireEmailVerification}
            onChange={setRequireEmailVerification}
            hint="Users must verify their email before accessing the platform."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Maintenance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <CheckboxField
            label="Enable Maintenance Mode"
            id="isMaintenanceMode"
            checked={isMaintenanceMode}
            onChange={setIsMaintenanceMode}
            hint="When enabled, users see the maintenance message instead of the site."
          />
          {isMaintenanceMode && (
            <TextArea
              label="Maintenance Message"
              id="maintenanceMessage"
              value={maintenanceMessage}
              onChange={setMaintenanceMessage}
              rows={3}
              placeholder="We'll be back shortly. Thank you for your patience."
            />
          )}
          <Field
            label="Support Email"
            id="supportEmail"
            value={supportEmail}
            onChange={setSupportEmail}
            type="email"
            placeholder="support@example.com"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Analytics &amp; Tracking</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Google Analytics ID"
            id="googleAnalyticsId"
            value={googleAnalyticsId}
            onChange={setGoogleAnalyticsId}
            placeholder="G-XXXXXXXXXX"
          />
          <Field
            label="Meta Pixel ID"
            id="pixelId"
            value={pixelId}
            onChange={setPixelId}
            placeholder="0000000000000"
          />
        </CardContent>
      </Card>

      <SaveBar saving={saving} error={error} success={success} />
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BrandEditPage({ brandId }: { brandId: string }) {
  const router = useRouter();
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
        Loading…
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="space-y-4">
        <Link
          href={`/platform/brands/${brandId}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Brand not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${brand.name}`}
        description="Changes are saved per-section."
        breadcrumb={
          <Link
            href={`/platform/brands/${brandId}`}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Brand
          </Link>
        }
      />

      <Tabs defaultValue="identity">
        <TabsList>
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="identity">
          <IdentityTab brand={brand} onSaved={setBrand} />
        </TabsContent>
        <TabsContent value="details">
          <DetailsTab brand={brand} onSaved={setBrand} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab brand={brand} onSaved={setBrand} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
