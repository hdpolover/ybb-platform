// services/admin-dashboard/app/components/programDetailsMasterData/landing-content/FurtherInformationSheet.tsx
// Adapted from app/platform/brands/[brandId]/BrandDetailPage.tsx's
// FurtherInformationSheet — same fields and mockup-image upload flow, now
// writing Program.landingContent via updateProgramLandingContent. Keeps a
// brandId prop only for uploadFileViaPresignedUrl's upload-target bucket,
// not for the content write.
"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { ImageIcon, Save, Upload, X } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { updateProgramLandingContent, type BrandFurtherInformation } from "@/app/platform/api";
import { FieldInput, FieldTextarea, SheetMsg, clampFileTitle } from "./shared";
import { uploadFileViaPresignedUrl } from "@/src/shared/api-client";

interface FurtherInformationSheetProps {
  programId: string;
  brandId: string;
  initial: BrandFurtherInformation | undefined;
  onSaved: () => void;
}

export function FurtherInformationSheet({ programId, brandId, initial, onSaved }: FurtherInformationSheetProps) {
  const { adminProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BrandFurtherInformation>(initial ?? {});
  const [pendingMockupFile, setPendingMockupFile] = useState<File | null>(null);
  const mockupInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof BrandFurtherInformation>(key: K, value: BrandFurtherInformation[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSave() {
    if (pendingMockupFile && !adminProfile?.userId) {
      setError("An admin user session is required before images can be uploaded.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let mockupUrl = form.mockup_image_url?.trim() || undefined;

      if (pendingMockupFile) {
        const upload = await uploadFileViaPresignedUrl(pendingMockupFile, {
          userId: adminProfile!.userId,
          brandId,
          bucket: "brands",
          assetType: "image",
          title: clampFileTitle(pendingMockupFile.name),
          altText: "Further information mockup image",
        });
        if (!upload.publicUrl) throw new Error("Mockup image upload succeeded but no public URL was returned.");
        mockupUrl = upload.publicUrl;
      }

      await updateProgramLandingContent(programId, {
        further_information: {
          eyebrow: form.eyebrow?.trim() || undefined,
          title: form.title?.trim() || undefined,
          subtitle: form.subtitle?.trim() || undefined,
          mockup_image_url: mockupUrl,
        },
      });
      toast.success("Further information CTA updated.");
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function openSheet() {
    setForm(initial ?? {});
    setPendingMockupFile(null);
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={openSheet}>
        Edit
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
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Mockup / Device Image</p>
              <p className="mb-3 text-xs text-zinc-500">The guidebook cover shown inside the phone &amp; tablet mockup on the right side of this section.</p>
              <div className="space-y-1.5">
                <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                  <div
                    className="flex h-28 items-center justify-center bg-zinc-50 cursor-pointer"
                    onClick={() => mockupInputRef.current?.click()}
                  >
                    {pendingMockupFile ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={URL.createObjectURL(pendingMockupFile)} alt="Mockup preview" className="h-full w-full object-contain p-2" />
                    ) : form.mockup_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.mockup_image_url} alt="Mockup image" className="h-full w-full object-contain p-2" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-zinc-400">
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-xs">Upload or paste URL</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 border-t border-zinc-100 p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" type="button" onClick={() => mockupInputRef.current?.click()}>
                        <Upload className="mr-1 h-3.5 w-3.5" /> Upload image
                      </Button>
                      {(pendingMockupFile || form.mockup_image_url) && (
                        <Button size="sm" variant="ghost" type="button" onClick={() => { setPendingMockupFile(null); set("mockup_image_url", undefined); }}>
                          <X className="mr-1 h-3.5 w-3.5" /> Clear
                        </Button>
                      )}
                    </div>
                    <Input
                      value={form.mockup_image_url ?? ""}
                      onChange={(e) => { set("mockup_image_url", e.target.value); setPendingMockupFile(null); }}
                      placeholder="https://... or /img/mockupjapan.png"
                    />
                    {pendingMockupFile && (
                      <p className="text-xs font-medium text-blue-600">{pendingMockupFile.name} selected. Save to upload.</p>
                    )}
                  </div>
                </div>
                <input ref={mockupInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setPendingMockupFile(f); if (f) set("mockup_image_url", undefined); e.target.value = ""; }} />
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
