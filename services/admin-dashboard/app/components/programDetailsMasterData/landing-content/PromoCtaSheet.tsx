// services/admin-dashboard/app/components/programDetailsMasterData/landing-content/PromoCtaSheet.tsx
// Adapted from app/platform/brands/[brandId]/BrandDetailPage.tsx's PromoCtaSheet —
// same fields, now writing Program.landingContent via updateProgramLandingContent.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { Save } from "lucide-react";
import { updateProgramLandingContent, type BrandPromoCta } from "@/app/platform/api";
import { FieldInput, FieldTextarea, SheetMsg } from "./shared";

interface PromoCtaSheetProps {
  programId: string;
  initial: BrandPromoCta | undefined;
  onSaved: () => void;
}

export function PromoCtaSheet({ programId, initial, onSaved }: PromoCtaSheetProps) {
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
      await updateProgramLandingContent(programId, { promo_cta: form });
      toast.success("Promo / CTA section updated.");
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
      <Button size="sm" variant="outline" onClick={() => { setForm(initial ?? {}); setError(null); setOpen(true); }}>
        Edit
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
