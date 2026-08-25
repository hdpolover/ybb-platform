"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon, Save, Upload } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { LogoOverrideWarning } from "@/src/admin/components/logo-override-warning";
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

function SelectField({
  label,
  id,
  value,
  onChange,
  options,
  hint,
  disabled,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
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
  disabled,
}: {
  label: string;
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
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
  const { adminProfile } = useAuth();
  const [name, setName] = useState(brand.name);
  const [slug, setSlug] = useState(brand.slug);
  const [description, setDescription] = useState(brand.description ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(brand.websiteUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(brand.primaryColor ?? "");
  const [isActive, setIsActive] = useState(brand.isActive);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logoUrl ?? null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(brand.bannerUrl ?? null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (url: string | null) => void,
  ) {
    const file = e.target.files?.[0] ?? null;
    setFile(file);
    if (file) setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!adminProfile?.userId) {
        throw new Error("You must be signed in to update brand identity.");
      }
      const updated = await updatePlatformBrandIdentity(brand.id, {
        name,
        slug,
        description: description || undefined,
        websiteUrl: websiteUrl || undefined,
        primaryColor: primaryColor || undefined,
        isActive,
        logo: logoFile ?? undefined,
        banner: bannerFile ?? undefined,
        userId: adminProfile.userId,
      });
      setSuccess("Identity saved.");
      setLogoFile(null);
      setBannerFile(null);
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
        <CardHeader><CardTitle>Media</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Banner */}
          <div className="space-y-2">
            <Label>Banner</Label>
            <div
              className="relative h-32 w-full cursor-pointer overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 hover:border-zinc-400"
              onClick={() => bannerInputRef.current?.click()}
            >
              {bannerPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerPreview} alt="Banner preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  <Upload className="h-6 w-6 text-zinc-400" />
                  <p className="text-xs text-zinc-400">Click to upload banner</p>
                </div>
              )}
              {bannerPreview && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                  <Upload className="h-6 w-6 text-white" />
                </div>
              )}
            </div>
            {bannerFile && <p className="text-xs text-zinc-500">{bannerFile.name}</p>}
            <p className="text-xs text-zinc-400">Recommended: 1200×400 or wider. PNG, JPG.</p>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onFileChange(e, setBannerFile, setBannerPreview)}
            />
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo</Label>
            <LogoOverrideWarning activeProgram={brand.activeProgram} brandLogoUrl={brand.logoUrl ?? null} />
            <div className="flex items-center gap-4">
              <div
                className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 hover:border-zinc-400"
                onClick={() => logoInputRef.current?.click()}
              >
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-1" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-zinc-300" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {logoFile ? logoFile.name : "Upload logo…"}
                </button>
                <p className="text-xs text-zinc-400">PNG, JPG, SVG, WEBP. Square recommended.</p>
              </div>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onFileChange(e, setLogoFile, setLogoPreview)}
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
        <CardHeader><CardTitle>Status</CardTitle></CardHeader>
        <CardContent>
          <CheckboxField
            label="Brand is Active"
            id="isActive"
            checked={isActive}
            onChange={setIsActive}
            hint="Inactive brands are hidden from the platform."
          />
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
  const [defaultLocation, setDefaultLocation] = useState(brand.defaultLocation ?? "");
  const [defaultCountry, setDefaultCountry] = useState(brand.defaultCountry ?? "");
  const [defaultTimezone, setDefaultTimezone] = useState(brand.defaultTimezone ?? "");
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
        socialMediaLinks: Object.keys(socialMediaLinks).length > 0 ? socialMediaLinks : undefined,
        defaultLocation: defaultLocation || undefined,
        defaultCountry: defaultCountry || undefined,
        defaultTimezone: defaultTimezone || undefined,
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
  // Only USD/IDR can actually settle; coerce any legacy value (e.g. a stray "CNY")
  // to IDR so saving the form doesn't trip the API's currency validation.
  const [defaultCurrency, setDefaultCurrency] = useState(
    brand.defaultCurrency === "USD" ? "USD" : "IDR",
  );
  const [enableMultiCurrency, setEnableMultiCurrency] = useState(brand.enableMultiCurrency ?? false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(s?.isMaintenanceMode ?? false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(s?.maintenanceMessage ?? "");
  const [supportEmail, setSupportEmail] = useState(s?.supportEmail ?? "");
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(s?.googleAnalyticsId ?? "");
  const [pixelId, setPixelId] = useState(s?.pixelId ?? "");
  // Secret, write-only: the backend never returns the raw token, only whether
  // one is set (hasCapiAccessToken). Start empty; only send a new value if the
  // admin actually types into this field, so an untouched field never clobbers
  // the stored token.
  const [capiAccessToken, setCapiAccessToken] = useState("");
  const hadCapiAccessToken = s?.hasCapiAccessToken ?? false;
  // Not secret — routed through the read response normally, unlike the token.
  const [capiTestEventCode, setCapiTestEventCode] = useState(s?.capiTestEventCode ?? "");

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
        isMaintenanceMode,
        maintenanceMessage: maintenanceMessage || undefined,
        supportEmail: supportEmail || undefined,
        googleAnalyticsId: googleAnalyticsId || undefined,
        pixelId: pixelId || undefined,
        // Omit unless the admin typed something — an empty string here would
        // be sent as "clear the token", which is not what an untouched field
        // means.
        capiAccessToken: capiAccessToken || undefined,
        capiTestEventCode: capiTestEventCode || undefined,
      });
      setSuccess("Settings saved.");
      setCapiAccessToken("");
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
          <SelectField
            label="Default Currency"
            id="defaultCurrency"
            value={defaultCurrency}
            onChange={setDefaultCurrency}
            options={[
              { value: "IDR", label: "IDR" },
              { value: "USD", label: "USD" },
            ]}
            hint="Display only. Settlement currency is set per program & pricing tier — this does not affect what participants pay."
          />
          <CheckboxField
            label="Enable Multi-Currency"
            id="enableMultiCurrency"
            checked={enableMultiCurrency}
            onChange={setEnableMultiCurrency}
            disabled
            hint="Not yet implemented. Payments settle in IDR/USD per pricing tier."
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
          <Field
            label="Meta CAPI Access Token"
            id="capiAccessToken"
            type="password"
            value={capiAccessToken}
            onChange={setCapiAccessToken}
            placeholder={hadCapiAccessToken ? "••••• (set) — leave blank to keep" : "Paste a new access token"}
            hint={
              hadCapiAccessToken
                ? "A token is already saved. It's write-only and never shown here — type a new value only to replace it."
                : "Used for server-side Meta Conversions API event forwarding."
            }
          />
          <Field
            label="Meta CAPI Test Event Code"
            id="capiTestEventCode"
            value={capiTestEventCode}
            onChange={setCapiTestEventCode}
            placeholder="TEST12345"
            hint="From Meta Events Manager's Test Events tab. Not secret — safe to display."
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
