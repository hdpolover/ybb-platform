"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import {
  getBrand,
  updateBrandDetails,
  updateBrandSettings,
  type BrandDetail,
} from "../../../src/shared/api-client";
import { useAuth } from "../../contexts/AuthContext";

type Tab = "general" | "contact" | "finance";

export default function SettingsPage() {
  const { adminProfile } = useAuth();
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("general");

  // General form
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [vision, setVision] = useState("");
  const [mission, setMission] = useState("");

  // Contact form
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [address, setAddress] = useState("");

  // Finance form
  const [defaultCurrency, setDefaultCurrency] = useState("IDR");
  const [usdInIdr, setUsdInIdr] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");

  const brandId = adminProfile?.assignedBrands?.[0]?.brandId ?? undefined;

  const fetchBrand = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBrand(brandId);
      setBrand(data);
      setName(data.name ?? "");
      setTagline(data.tagline ?? "");
      setDescription(data.description ?? "");
      setVision(data.vision ?? "");
      setMission(data.mission ?? "");
      setContactEmail(data.contactEmail ?? "");
      setContactPhone(data.contactPhone ?? "");
      setWhatsappNumber(data.whatsappNumber ?? "");
      setAddress(data.address ?? "");
      setDefaultCurrency(data.settings?.defaultCurrency ?? "IDR");
      setUsdInIdr(String(data.settings?.usdInIdr ?? ""));
      setTimezone(data.settings?.timezone ?? "Asia/Jakarta");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load brand settings");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    fetchBrand();
  }, [fetchBrand]);

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateBrandDetails(brandId, { name, tagline, description, vision, mission });
      setSuccess("General settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateBrandDetails(brandId, { contactEmail, contactPhone, whatsappNumber, address });
      setSuccess("Contact settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFinance(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateBrandSettings(brandId, {
        defaultCurrency,
        usdInIdr: usdInIdr ? Number(usdInIdr) : undefined,
        timezone,
      });
      setSuccess("Finance settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "contact", label: "Contact" },
    { key: "finance", label: "Finance" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Platform Settings</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Configure brand-wide settings and preferences
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {brand && (
            <span className="text-zinc-500">
              Brand: <span className="font-semibold text-zinc-700">{brand.name}</span>
            </span>
          )}
          <button
            type="button"
            onClick={fetchBrand}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-600 shadow-sm hover:bg-zinc-50"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>
      )}

      {loading && <p className="text-xs text-zinc-400">Loading settings&hellip;</p>}

      {!loading && !brandId && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          No brand assigned to your account.
        </p>
      )}

      {!loading && brandId && (
        <div className="rounded-md border border-zinc-200 bg-white shadow-sm">
          {/* Tabs */}
          <div className="flex border-b border-zinc-200">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setTab(t.key); setSuccess(null); setError(null); }}
                className={`px-4 py-2.5 text-[11px] font-medium transition ${
                  tab === t.key
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-4">
            {/* General Tab */}
            {tab === "general" && (
              <form onSubmit={handleSaveGeneral} className="space-y-3">
                <Field label="Brand Name" required>
                  <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Tagline">
                  <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Description">
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
                </Field>
                <Field label="Vision">
                  <textarea value={vision} onChange={(e) => setVision(e.target.value)} rows={2} className={inputCls} />
                </Field>
                <Field label="Mission">
                  <textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={2} className={inputCls} />
                </Field>
                <SaveButton saving={saving} />
              </form>
            )}

            {/* Contact Tab */}
            {tab === "contact" && (
              <form onSubmit={handleSaveContact} className="space-y-3">
                <Field label="Contact Email">
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Contact Phone">
                  <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} />
                </Field>
                <Field label="WhatsApp Number">
                  <input type="text" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Address">
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={inputCls} />
                </Field>
                <SaveButton saving={saving} />
              </form>
            )}

            {/* Finance Tab */}
            {tab === "finance" && (
              <form onSubmit={handleSaveFinance} className="space-y-3">
                <Field label="Default Currency">
                  <select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} className={inputCls}>
                    <option value="IDR">IDR - Indonesian Rupiah</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                  </select>
                </Field>
                <Field label="USD to IDR Rate">
                  <input
                    type="number"
                    value={usdInIdr}
                    onChange={(e) => setUsdInIdr(e.target.value)}
                    placeholder="e.g. 15800"
                    className={inputCls}
                  />
                </Field>
                <Field label="Timezone">
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls}>
                    <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                    <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                    <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </Field>
                <SaveButton saving={saving} />
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function SaveButton({ saving }: { saving: boolean }) {
  return (
    <div className="flex justify-end pt-2">
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-blue-500 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
      >
        {saving ? "Saving\u2026" : "Save Changes"}
      </button>
    </div>
  );
}


