// services/admin-dashboard/app/platform/settings/platform-content/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/src/admin/page-header";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import { useAuth } from "@/app/contexts/AuthContext";
import { getImpactStats, updateImpactStats, type ImpactStats } from "@/app/platform/api";

type ImpactStatsForm = {
  totalAlumni: string;
  editionsHeld: string;
  totalCountries: string;
  totalParticipants: string;
};

const EMPTY_FORM: ImpactStatsForm = {
  totalAlumni: "",
  editionsHeld: "",
  totalCountries: "",
  totalParticipants: "",
};

function toForm(stats: ImpactStats): ImpactStatsForm {
  return {
    totalAlumni: stats.totalAlumni ?? "",
    editionsHeld: stats.editionsHeld ?? "",
    totalCountries: stats.totalCountries ?? "",
    totalParticipants: stats.totalParticipants ?? "",
  };
}

export default function PlatformContentPage() {
  const { accessConfig } = useAuth();
  const canManage = accessConfig.isSuperAdmin;

  const [form, setForm] = useState<ImpactStatsForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getImpactStats();
      setForm(toForm(data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load impact stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    void load();
  }, [canManage, load]);

  function set<K extends keyof ImpactStatsForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateImpactStats({
        totalAlumni: form.totalAlumni || undefined,
        editionsHeld: form.editionsHeld || undefined,
        totalCountries: form.totalCountries || undefined,
        totalParticipants: form.totalParticipants || undefined,
      });
      setForm(toForm(updated));
      toast.success("Impact stats updated for every brand's landing page.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save impact stats.");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Platform Content"
          description="Only super admins can manage organisation-wide landing page content."
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You do not have permission to access this page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Content"
        description="Organisation-wide values shared across every brand's landing page — not brand- or program-scoped."
      />

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          This is a single shared setting read by all 8 brands. Saving here changes every brand&apos;s landing
          page at once, not just one — there is no per-brand override anymore.
        </span>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Impact Stats</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Headline figures shown on every brand&apos;s landing page (total alumni, editions held, countries
              reached, total participants).
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading settings...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="totalAlumni">Total Alumni</Label>
                <Input
                  id="totalAlumni"
                  value={form.totalAlumni}
                  onChange={(e) => set("totalAlumni", e.target.value)}
                  placeholder="1700+"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editionsHeld">Editions Held</Label>
                <Input
                  id="editionsHeld"
                  value={form.editionsHeld}
                  onChange={(e) => set("editionsHeld", e.target.value)}
                  placeholder="15+"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalCountries">Total Countries</Label>
                <Input
                  id="totalCountries"
                  value={form.totalCountries}
                  onChange={(e) => set("totalCountries", e.target.value)}
                  placeholder="50+"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalParticipants">Total Participants</Label>
                <Input
                  id="totalParticipants"
                  value={form.totalParticipants}
                  onChange={(e) => set("totalParticipants", e.target.value)}
                  placeholder="1700+"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button onClick={() => void handleSave()} loading={saving}>
                Save Impact Stats
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
