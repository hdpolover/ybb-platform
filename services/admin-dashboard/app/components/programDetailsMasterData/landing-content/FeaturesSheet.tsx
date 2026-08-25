// services/admin-dashboard/app/components/programDetailsMasterData/landing-content/FeaturesSheet.tsx
// Adapted from app/platform/brands/[brandId]/BrandDetailPage.tsx's FeaturesSheet —
// same fields, now writing Program.landingContent via updateProgramLandingContent.
// Drops brandId entirely: this sheet never uploads media, so it never needed
// brandId beyond the old metadata write.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { Plus, Save, X } from "lucide-react";
import { updateProgramLandingContent, type BrandFeature } from "@/app/platform/api";
import { FieldInput, FieldTextarea, SheetMsg } from "./shared";

interface FeaturesSheetProps {
  programId: string;
  initial: BrandFeature[] | undefined;
  onSaved: () => void;
}

export function FeaturesSheet({ programId, initial, onSaved }: FeaturesSheetProps) {
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
    setFeatures((fs) => fs.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateProgramLandingContent(programId, { features });
      toast.success("Key features updated.");
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
        Edit
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
