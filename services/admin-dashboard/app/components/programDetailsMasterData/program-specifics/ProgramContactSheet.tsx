// services/admin-dashboard/app/components/programDetailsMasterData/program-specifics/ProgramContactSheet.tsx
// New — no BrandDetailPage.tsx analogue carries social media, which stays
// Brand-owned. PUT /programs/:id/contact replaces the whole block (an
// omitted field clears to null server-side), so every field is sent
// explicitly on save.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { updateProgramContact } from "@/app/platform/api";
import { FieldInput, FieldTextarea } from "../landing-content/shared";

interface ProgramContactSheetProps {
  programId: string;
  initial: {
    contactEmail?: string | null;
    contactPhone?: string | null;
    contactWhatsapp?: string | null;
    contactAddress?: string | null;
  };
  onSaved: () => void;
}

function toFormValues(initial: ProgramContactSheetProps["initial"]) {
  return {
    contactEmail: initial.contactEmail ?? "",
    contactPhone: initial.contactPhone ?? "",
    contactWhatsapp: initial.contactWhatsapp ?? "",
    contactAddress: initial.contactAddress ?? "",
  };
}

export function ProgramContactSheet({ programId, initial, onSaved }: ProgramContactSheetProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(toFormValues(initial));

  function resetState() {
    setForm(toFormValues(initial));
    setError(null);
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  // Mirrors UpdateProgramContactDto's @MaxLength() caps client-side so an
  // oversized value surfaces as a field-level error here instead of an
  // opaque Postgres 22001 -> 500 (see Global Constraints: VarChar overflow
  // defect class). contactAddress is Text in the DTO/DB, so it is uncapped.
  const CONTACT_EMAIL_MAX_LEN = 255;
  const CONTACT_PHONE_MAX_LEN = 50;
  const CONTACT_WHATSAPP_MAX_LEN = 50;

  function validate(): string | null {
    if (form.contactEmail.length > CONTACT_EMAIL_MAX_LEN) {
      return `Email must be ${CONTACT_EMAIL_MAX_LEN} characters or fewer.`;
    }
    if (form.contactPhone.length > CONTACT_PHONE_MAX_LEN) {
      return `Phone must be ${CONTACT_PHONE_MAX_LEN} characters or fewer.`;
    }
    if (form.contactWhatsapp.length > CONTACT_WHATSAPP_MAX_LEN) {
      return `WhatsApp must be ${CONTACT_WHATSAPP_MAX_LEN} characters or fewer.`;
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
      // PUT /programs/:id/contact REPLACES the whole block — send every
      // field explicitly, matching UpdateProgramContactHandler's semantics
      // (an omitted field clears to null server-side).
      await updateProgramContact(programId, {
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        contactWhatsapp: form.contactWhatsapp || undefined,
        contactAddress: form.contactAddress || undefined,
      });
      toast.success("Contact information updated.");
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact information.");
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
        Edit Contact
      </Button>
      <Sheet open={open} onOpenChange={(v) => !v && !saving && setOpen(false)}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Program Contact</SheetTitle>
            <SheetDescription>Shown on this program&apos;s public landing page as its support contact.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <FieldInput label="Email" id="contactEmail" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} type="email" placeholder="contact@example.com" hint="Max 255 characters." maxLength={CONTACT_EMAIL_MAX_LEN} />
            <FieldInput label="Phone" id="contactPhone" value={form.contactPhone} onChange={(v) => set("contactPhone", v)} placeholder="+62 21 1234 5678" hint="Max 50 characters." maxLength={CONTACT_PHONE_MAX_LEN} />
            <FieldInput label="WhatsApp" id="contactWhatsapp" value={form.contactWhatsapp} onChange={(v) => set("contactWhatsapp", v)} placeholder="628123456789" hint="Max 50 characters." maxLength={CONTACT_WHATSAPP_MAX_LEN} />
            <FieldTextarea label="Address" id="contactAddress" value={form.contactAddress} onChange={(v) => set("contactAddress", v)} rows={3} />
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
