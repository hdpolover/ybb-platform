// services/admin-dashboard/app/components/programDetailsMasterData/program-specifics/ProgramPartnersCanvaSheet.tsx
// Per-program successor to BrandDetailPage's old PartnersCanvaSheet (which
// edited the single Brand.metadata.partners_canva_url slot). PUT
// /programs/:id/partners-canva-url replaces the field — an omitted/null
// value clears it server-side, matching UpdateProgramPartnersCanvaUrlHandler.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { updateProgramPartnersCanvaUrl } from "@/app/platform/api";
import { FieldInput } from "../landing-content/shared";

interface ProgramPartnersCanvaSheetProps {
  programId: string;
  initial: string | null;
  onSaved: () => void;
}

export function ProgramPartnersCanvaSheet({ programId, initial, onSaved }: ProgramPartnersCanvaSheetProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(initial ?? "");

  function resetState() {
    setUrl(initial ?? "");
    setError(null);
  }

  function validate(): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null;
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname !== "www.canva.com" && parsed.hostname !== "canva.com") {
        return "Must be a canva.com URL (Share -> Embed).";
      }
    } catch {
      return "Enter a valid URL.";
    }
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateProgramPartnersCanvaUrl(programId, url.trim() || null);
      toast.success("Partners page Canva embed updated.");
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Canva embed URL.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          resetState();
          setOpen(true);
        }}
      >
        Edit Canva Embed
      </Button>
      <Sheet open={open} onOpenChange={(v) => !v && !saving && setOpen(false)}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Partners Page Canva Embed</SheetTitle>
            <SheetDescription>
              Shown on the Partners page for this program, labelled with the program name. Leave blank to remove the embed.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <FieldInput
              label="Canva Embed URL"
              id="partnersCanvaUrl"
              value={url}
              onChange={setUrl}
              placeholder="https://www.canva.com/design/.../view?embed"
              hint="Use Canva's Share -> Embed link, set to Anyone with the link can view."
            />
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
