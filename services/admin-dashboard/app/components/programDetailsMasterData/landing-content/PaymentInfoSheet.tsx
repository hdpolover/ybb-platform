// services/admin-dashboard/app/components/programDetailsMasterData/landing-content/PaymentInfoSheet.tsx
// Adapted from app/platform/brands/[brandId]/BrandDetailPage.tsx's PaymentInfoSheet —
// same fields, now writing Program.landingContent via updateProgramLandingContent.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { Plus, Save, X } from "lucide-react";
import { updateProgramLandingContent, type BrandPaymentInfo, type BrandPaymentInfoItem } from "@/app/platform/api";
import { FieldInput, FieldTextarea, SheetMsg, normalizePaymentInfo } from "./shared";

interface PaymentInfoSheetProps {
  programId: string;
  initial: BrandPaymentInfo | undefined;
  onSaved: () => void;
}

export function PaymentInfoSheet({ programId, initial, onSaved }: PaymentInfoSheetProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BrandPaymentInfo>(normalizePaymentInfo(initial));

  function resetState() {
    setForm(normalizePaymentInfo(initial));
    setError(null);
  }

  function setField<K extends keyof BrandPaymentInfo>(key: K, value: BrandPaymentInfo[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function setItemField(index: number, key: keyof BrandPaymentInfoItem, value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
    setError(null);
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: `payment-item-${Date.now()}`,
          icon: "payment_schedule",
          title: "",
          body: "",
        },
      ],
    }));
    setError(null);
  }

  function removeItem(index: number) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const sanitizedItems = form.items.map((item, index) => ({
        id: item.id.trim() || `payment-item-${index + 1}`,
        icon: item.icon.trim() || "payment_schedule",
        title: item.title.trim(),
        body: item.body.trim(),
      }));

      await updateProgramLandingContent(programId, {
        payment_info: {
          eyebrow: form.eyebrow.trim(),
          title: form.title.trim(),
          introText: form.introText.trim(),
          items: sanitizedItems,
          note: form.note.trim(),
        },
      });
      toast.success("Payment & selection section updated.");
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
        <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Payment &amp; Selection Section</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <FieldInput label="Eyebrow" id="payment-info-eyebrow" value={form.eyebrow} onChange={(value) => setField("eyebrow", value)} />
            <FieldInput label="Title" id="payment-info-title" value={form.title} onChange={(value) => setField("title", value)} />
            <FieldTextarea label="Intro Text" id="payment-info-intro" value={form.introText} onChange={(value) => setField("introText", value)} rows={3} />

            <div className="space-y-3 border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Cards</p>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Card
                </Button>
              </div>

              {form.items.length === 0 ? (
                <p className="text-sm text-zinc-400">No cards configured.</p>
              ) : (
                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-zinc-500">Card {index + 1}</p>
                        <Button size="sm" variant="ghost" onClick={() => removeItem(index)}>
                          <X className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FieldInput label="ID" id={`payment-item-id-${index}`} value={item.id} onChange={(value) => setItemField(index, "id", value)} />
                        <FieldInput label="Icon key" id={`payment-item-icon-${index}`} value={item.icon} onChange={(value) => setItemField(index, "icon", value)} />
                      </div>
                      <FieldInput label="Card Title" id={`payment-item-title-${index}`} value={item.title} onChange={(value) => setItemField(index, "title", value)} />
                      <FieldTextarea label="Card Body" id={`payment-item-body-${index}`} value={item.body} onChange={(value) => setItemField(index, "body", value)} rows={3} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FieldTextarea label="Bottom Note" id="payment-info-note" value={form.note} onChange={(value) => setField("note", value)} rows={2} />
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
