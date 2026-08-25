// services/admin-dashboard/app/components/programDetailsMasterData/landing-content/BenefitsSheet.tsx
// Adapted from app/platform/brands/[brandId]/BrandDetailPage.tsx's BenefitsSheet
// (brandId-scoped Brand.metadata writer) — same fields, group management, and
// image-upload flow, now writing Program.landingContent via
// updateProgramLandingContent instead of updatePlatformBrandMetadata.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { Label } from "@/src/ui/label";
import { Plus, Save, X } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { updateProgramLandingContent, type BenefitGroup, type ProgramLandingContent } from "@/app/platform/api";
import { FieldInput, SheetMsg, normalizeBenefitGroup, normalizeBenefitGroups, BenefitGroupImageField, clampFileTitle } from "./shared";
import { uploadFileViaPresignedUrl } from "@/src/shared/api-client";

interface BenefitsSheetProps {
  programId: string;
  brandId: string;
  initial: ProgramLandingContent["benefits"];
  onSaved: () => void;
}

export function BenefitsSheet({ programId, brandId, initial, onSaved }: BenefitsSheetProps) {
  const { adminProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eyebrow, setEyebrow] = useState(initial?.eyebrow ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [groups, setGroups] = useState<BenefitGroup[]>(normalizeBenefitGroups(initial?.groups));
  const [pendingImages, setPendingImages] = useState<Record<string, File | null>>({});

  function resetState() {
    setEyebrow(initial?.eyebrow ?? "");
    setTitle(initial?.title ?? "");
    setGroups(normalizeBenefitGroups(initial?.groups));
    setPendingImages({});
    setError(null);
  }

  function addGroup() {
    setGroups((gs) => [...gs, normalizeBenefitGroup({ title: "", imageUrl: "", items: [""] }, gs.length)]);
  }

  function removeGroup(idx: number) {
    setGroups((gs) => {
      const target = gs[idx];
      if (target) {
        setPendingImages((current) => {
          const next = { ...current };
          delete next[target.id];
          return next;
        });
      }
      return gs.filter((_, i) => i !== idx);
    });
  }

  function setGroupField(idx: number, field: keyof BenefitGroup, value: string) {
    setGroups((gs) => gs.map((g, i) => (i === idx ? { ...g, [field]: value } : g)));
  }

  function setGroupImageFile(idx: number, file: File | null) {
    setGroups((gs) => {
      const target = gs[idx];
      if (!target) return gs;
      setPendingImages((current) => ({ ...current, [target.id]: file }));
      return gs;
    });
  }

  function setGroupImageUrl(idx: number, url: string) {
    setGroups((gs) => gs.map((group, groupIndex) => (groupIndex === idx ? { ...group, imageUrl: url } : group)));
    setPendingImages((current) => {
      const target = groups[idx];
      if (!target) return current;
      const next = { ...current };
      delete next[target.id];
      return next;
    });
  }

  function clearGroupImage(idx: number) {
    setGroups((gs) => gs.map((group, groupIndex) => (groupIndex === idx ? { ...group, imageUrl: "" } : group)));
    setPendingImages((current) => {
      const target = groups[idx];
      if (!target) return current;
      const next = { ...current };
      delete next[target.id];
      return next;
    });
  }

  function setGroupItems(idx: number, items: string[]) {
    setGroups((gs) => gs.map((g, i) => (i === idx ? { ...g, items } : g)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (Object.values(pendingImages).some(Boolean) && !adminProfile?.userId) {
        throw new Error("An admin user session is required before images can be uploaded.");
      }

      const resolvedGroups = await Promise.all(
        groups.map(async (group) => {
          const pendingFile = pendingImages[group.id];
          let imageUrl = group.imageUrl || undefined;

          if (pendingFile) {
            const upload = await uploadFileViaPresignedUrl(pendingFile, {
              userId: adminProfile!.userId,
              brandId,
              bucket: "brands",
              assetType: "image",
              title: clampFileTitle(pendingFile.name),
              altText: group.title || title || eyebrow || "Benefit group image",
            });

            if (!upload.publicUrl) {
              throw new Error(`Image upload succeeded for ${pendingFile.name} but no public URL was returned.`);
            }

            imageUrl = upload.publicUrl;
          }

          return {
            ...group,
            imageUrl,
            items: group.items.map((item) => item.trim()).filter(Boolean),
          };
        }),
      );

      await updateProgramLandingContent(programId, {
        benefits: { eyebrow, title, groups: resolvedGroups },
      });
      toast.success("Benefits section updated.");
      setPendingImages({});
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
            <SheetTitle>Edit Program Benefits</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <SheetMsg message={error} variant="error" />
            <FieldInput label="Eyebrow text" id="ben-eyebrow" value={eyebrow} onChange={setEyebrow} placeholder="Program Benefits" />
            <FieldInput label="Section title" id="ben-title" value={title} onChange={setTitle} placeholder="Built for Students & Professionals" />

            <div className="border-t border-zinc-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Audience Groups</p>
                <Button size="sm" variant="outline" onClick={addGroup}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Group
                </Button>
              </div>
              <div className="space-y-4">
                {groups.map((group, gi) => (
                  <div key={group.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-zinc-500">Group {gi + 1}</p>
                      <Button size="sm" variant="ghost" onClick={() => removeGroup(gi)}>
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                    <FieldInput label="Title" id={`g-title-${gi}`} value={group.title} onChange={(v) => setGroupField(gi, "title", v)} placeholder="Benefits for High School Students" />
                    <BenefitGroupImageField
                      brandId={brandId}
                      groupId={group.id}
                      value={group.imageUrl}
                      pendingFile={pendingImages[group.id] ?? null}
                      onFileChange={(file) => setGroupImageFile(gi, file)}
                      onUrlChange={(url) => setGroupImageUrl(gi, url)}
                      onClear={() => clearGroupImage(gi)}
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Benefit Items</Label>
                        <button
                          type="button"
                          className="text-xs text-blue-500 hover:underline"
                          onClick={() => setGroupItems(gi, [...group.items, ""])}
                        >
                          + Add item
                        </button>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((item, ii) => (
                          <div key={ii} className="flex gap-2">
                            <input
                              className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              value={item}
                              placeholder={`Item ${ii + 1}`}
                              onChange={(e) => {
                                const newItems = [...group.items];
                                newItems[ii] = e.target.value;
                                setGroupItems(gi, newItems);
                              }}
                            />
                            <button
                              type="button"
                              className="shrink-0 text-zinc-400 hover:text-red-500"
                              onClick={() => setGroupItems(gi, group.items.filter((_, i) => i !== ii))}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="py-4 text-center text-sm text-zinc-400">No groups yet. Add a group to create one.</p>
                )}
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
