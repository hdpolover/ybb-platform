// services/admin-dashboard/app/components/programDetailsMasterData/landing-content/MomentsShortsSheet.tsx
// Adapted from app/platform/brands/[brandId]/BrandDetailPage.tsx's MomentsShortsSheet —
// same fields, now writing Program.landingContent via updateProgramLandingContent.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { Save } from "lucide-react";
import { updateProgramLandingContent, type BrandMomentsShorts } from "@/app/platform/api";
import { FieldInput, FieldTextarea, SheetMsg } from "./shared";

interface MomentsShortsSheetProps {
  programId: string;
  initial: BrandMomentsShorts | undefined;
  onSaved: () => void;
}

export function MomentsShortsSheet({ programId, initial, onSaved }: MomentsShortsSheetProps) {
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
      await updateProgramLandingContent(programId, { moments_shorts: form });
      toast.success("Moments shorts updated.");
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
