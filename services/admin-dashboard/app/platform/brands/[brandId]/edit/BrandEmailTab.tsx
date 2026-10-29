// services/admin-dashboard/app/platform/brands/[brandId]/edit/BrandEmailTab.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/src/ui/badge";
import { Button } from "@/src/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import {
  getBrandEmailPreviewHtml,
  getBrandEmailTheme,
  resyncBrandEmailTheme,
  saveBrandEmailTheme,
  type BrandEmailSyncState,
  type BrandEmailTheme,
  type BrandEmailThemeResponse,
} from "@/src/shared/api-client";

type ThemeForm = Record<keyof BrandEmailTheme, string>;

const BUTTON_STYLE_OPTIONS = [
  { value: "", label: "Default" },
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
  { value: "pill", label: "Pill" },
];

const SYNC_BADGE: Record<
  BrandEmailSyncState,
  { label: string; variant: "success" | "destructive" | "secondary" | "warning" }
> = {
  synced: { label: "Synced", variant: "success" },
  failed: { label: "Sync failed", variant: "destructive" },
  never: { label: "Not synced yet", variant: "warning" },
  not_configured: { label: "Listmonk not configured", variant: "secondary" },
};

const INPUT_CLASS =
  "flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

/** Form state from the stored theme; a missing key becomes '' (= use default). */
export function toThemeForm(theme: BrandEmailTheme): ThemeForm {
  return {
    fromName: theme.fromName ?? "",
    fromLocalPart: theme.fromLocalPart ?? "",
    replyTo: theme.replyTo ?? "",
    bannerUrl: theme.bannerUrl ?? "",
    footerText: theme.footerText ?? "",
    secondaryColor: theme.secondaryColor ?? "",
    accentColor: theme.accentColor ?? "",
    buttonStyle: theme.buttonStyle ?? "",
  };
}

/** PUT replaces the whole theme, so every field is sent; '' clears one. */
export function toThemePayload(form: ThemeForm): ThemeForm {
  return {
    fromName: form.fromName.trim(),
    fromLocalPart: form.fromLocalPart.trim().toLowerCase(),
    replyTo: form.replyTo.trim(),
    bannerUrl: form.bannerUrl.trim(),
    footerText: form.footerText.trim(),
    secondaryColor: form.secondaryColor.trim(),
    accentColor: form.accentColor.trim(),
    buttonStyle: form.buttonStyle,
  };
}

function formatSyncedAt(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function SyncStatus({
  sync,
  resyncing,
  onResync,
}: {
  sync: BrandEmailThemeResponse["sync"];
  resyncing: boolean;
  onResync: () => void;
}) {
  const badge = SYNC_BADGE[sync.state];
  const syncedAt = formatSyncedAt(sync.syncedAt);
  return (
    <Card>
      <CardHeader><CardTitle>Listmonk sync</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {syncedAt && <span className="text-xs text-zinc-500">Last attempt {syncedAt}</span>}
        </div>
        {sync.state === "failed" && sync.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {sync.error}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={resyncing}
          disabled={resyncing || sync.state === "not_configured"}
          onClick={onResync}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Resync to Listmonk
        </Button>
      </CardContent>
    </Card>
  );
}

export function BrandEmailTab({
  brandId,
  brandBannerUrl,
}: {
  brandId: string;
  /** Banner uploaded on the Identity tab; offered as a one-click source. */
  brandBannerUrl?: string | null;
}) {
  const [data, setData] = useState<BrandEmailThemeResponse | null>(null);
  const [form, setForm] = useState<ThemeForm | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  // The preview endpoint renders the SAVED theme, so refresh it after every save/resync.
  const refreshPreview = useCallback(async () => {
    try {
      setPreviewHtml(await getBrandEmailPreviewHtml(brandId));
    } catch (err) {
      setPreviewHtml(null);
      toast.error(err instanceof Error ? err.message : "Failed to load email preview.");
    }
  }, [brandId]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await getBrandEmailTheme(brandId);
      setData(response);
      setForm(toThemeForm(response.theme));
      await refreshPreview();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load email settings.");
    }
  }, [brandId, refreshPreview]);

  // Fetch-on-mount; `load` only changes identity when brandId changes.
  useEffect(() => { void load(); }, [load]);

  if (loadError) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data || !form) {
    return <div className="py-8 text-center text-sm text-zinc-500">Loading…</div>;
  }

  const { effective } = data;
  const fromDomain = effective.fromEmail.split("@")[1] ?? "";
  const set = (key: keyof ThemeForm) => (value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  const canUseBrandBanner = !!brandBannerUrl && brandBannerUrl.startsWith("https://");

  async function applyResponse(response: BrandEmailThemeResponse) {
    setData(response);
    setForm(toThemeForm(response.theme));
    await refreshPreview();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const response = await saveBrandEmailTheme(brandId, toThemePayload(form));
      await applyResponse(response);
      if (response.sync.state === "failed") {
        toast.warning("Saved, but the Listmonk template sync failed. See sync status.");
      } else {
        toast.success("Email look saved.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save email look.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResync() {
    setResyncing(true);
    try {
      const response = await resyncBrandEmailTheme(brandId);
      setData(response);
      if (response.sync.state === "failed") toast.error("Listmonk sync failed. See sync status.");
      else toast.success("Template resynced.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resync.");
    } finally {
      setResyncing(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={handleSave} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Sender</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="emailFromName">From name</Label>
              <Input
                id="emailFromName"
                value={form.fromName}
                onChange={(e) => set("fromName")(e.target.value)}
                placeholder={effective.fromName}
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailFromLocalPart">From address</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="emailFromLocalPart"
                  value={form.fromLocalPart}
                  onChange={(e) => set("fromLocalPart")(e.target.value)}
                  placeholder={effective.fromLocalPart}
                  maxLength={31}
                  className="font-mono"
                />
                <span className="shrink-0 text-sm text-zinc-500">@{fromDomain}</span>
              </div>
              <p className="text-xs text-zinc-400">
                Lowercase letters, digits, dots or hyphens. The domain is fixed.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailReplyTo">Reply-To</Label>
              <Input
                id="emailReplyTo"
                type="email"
                value={form.replyTo}
                onChange={(e) => set("replyTo")(e.target.value)}
                placeholder={effective.replyTo ?? "No reply-to"}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Look</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="emailBannerUrl">Header banner image URL</Label>
              <Input
                id="emailBannerUrl"
                type="url"
                value={form.bannerUrl}
                onChange={(e) => set("bannerUrl")(e.target.value)}
                placeholder={effective.bannerUrl ?? "https://"}
              />
              <div className="flex flex-wrap items-center gap-3">
                {canUseBrandBanner && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => set("bannerUrl")(brandBannerUrl)}
                  >
                    Use brand banner
                  </Button>
                )}
                <p className="text-xs text-zinc-400">
                  https only. Upload images on the Identity tab, then reuse the brand banner here.
                </p>
              </div>
              {form.bannerUrl.startsWith("https://") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.bannerUrl}
                  alt="Email banner"
                  className="mt-1 max-h-24 w-full rounded-lg border border-zinc-200 object-cover"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailSecondaryColor">Secondary color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="emailSecondaryColor-picker"
                  type="color"
                  aria-label="Secondary color picker"
                  value={form.secondaryColor || effective.secondaryColor}
                  onChange={(e) => set("secondaryColor")(e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded border border-zinc-200 bg-white p-0.5"
                />
                <Input
                  id="emailSecondaryColor"
                  value={form.secondaryColor}
                  onChange={(e) => set("secondaryColor")(e.target.value)}
                  placeholder={effective.secondaryColor}
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-zinc-400">#RRGGBB. Primary color comes from the Identity tab.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailAccentColor">Accent color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="emailAccentColor-picker"
                  type="color"
                  aria-label="Accent color picker"
                  value={form.accentColor || effective.accentColor}
                  onChange={(e) => set("accentColor")(e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded border border-zinc-200 bg-white p-0.5"
                />
                <Input
                  id="emailAccentColor"
                  value={form.accentColor}
                  onChange={(e) => set("accentColor")(e.target.value)}
                  placeholder={effective.accentColor}
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-zinc-400">
                Top bar and divider. Leave empty to use the brand primary color.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailButtonStyle">Button style</Label>
              <select
                id="emailButtonStyle"
                value={form.buttonStyle}
                onChange={(e) => set("buttonStyle")(e.target.value)}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {BUTTON_STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value ? o.label : `Default (${effective.buttonStyle})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailFooterText">Footer text</Label>
              <textarea
                id="emailFooterText"
                rows={3}
                maxLength={500}
                value={form.footerText}
                onChange={(e) => set("footerText")(e.target.value)}
                placeholder={effective.footerText}
                className={INPUT_CLASS}
              />
              <p className="text-xs text-zinc-400">Plain text, max 500 characters.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        <SyncStatus sync={data.sync} resyncing={resyncing} onResync={() => void handleResync()} />
        <Card>
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-zinc-400">Shows the saved version. Save to see changes.</p>
            {previewHtml ? (
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={previewHtml}
                className="h-[640px] w-full rounded-lg border border-zinc-200 bg-white"
              />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-200 text-sm text-zinc-500">
                Preview unavailable.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
