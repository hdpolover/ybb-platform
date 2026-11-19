// services/admin-dashboard/app/components/programAwardsMasterData/AwardSheet.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createProgramAward, updateProgramAward, type ProgramAward } from "@/src/shared/api-client";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { awardToForm, buildAwardPayload, emptyAwardForm, type AwardFormState } from "./award-form";

interface AwardSheetProps {
  open: boolean;
  programId: string;
  item?: ProgramAward;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

export function AwardSheet({ open, programId, item, nextOrder, onClose, onSaved }: AwardSheetProps) {
  const [form, setForm] = useState<AwardFormState>(() => emptyAwardForm(nextOrder));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(item ? awardToForm(item) : emptyAwardForm(nextOrder));
    setError(null);
  }, [open, item, nextOrder]);

  const set = <K extends keyof AwardFormState>(key: K, value: AwardFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = buildAwardPayload(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (item) {
        await updateProgramAward(programId, item.id, result.payload);
        toast.success("Award updated.");
      } else {
        await createProgramAward(programId, result.payload);
        toast.success("Award created.");
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save award";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const colorIsValid = /^#[0-9A-Fa-f]{6}$/.test(form.color.trim());

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col p-0 sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-zinc-200 px-6 py-5">
            <SheetTitle>{item ? "Edit Award" : "Add Award"}</SheetTitle>
            <SheetDescription>
              {item ? "Update this award. Changes show on the public landing page." : "Add an award presented in this program."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <Field label="Name" required>
              <input required maxLength={255} type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Best Delegate" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <input maxLength={100} type="text" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Delegate" className={inputCls} />
              </Field>
              <Field label="Tier">
                <input maxLength={50} type="text" value={form.tier} onChange={(e) => set("tier", e.target.value)} placeholder="e.g. gold" className={inputCls} />
              </Field>
            </div>
            <Field label="Description">
              <textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What the award recognises." className={inputCls} />
            </Field>
            <Field label="Tags" hint="Comma-separated">
              <input type="text" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Leadership, Public Speaking" className={inputCls} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Winners">
                <input type="number" min={0} step={1} value={form.winnerCount} onChange={(e) => set("winnerCount", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Order">
                <input required type="number" step={1} value={form.order} onChange={(e) => set("order", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Color">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-6 w-6 shrink-0 rounded border border-zinc-200"
                    style={colorIsValid ? { backgroundColor: form.color.trim() } : undefined}
                  />
                  <input type="text" maxLength={7} value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="#1D4ED8" className={inputCls} />
                </div>
              </Field>
            </div>
            <Field label="Icon URL">
              <input type="url" maxLength={500} value={form.iconUrl} onChange={(e) => set("iconUrl", e.target.value)} placeholder="https://…" className={inputCls} />
            </Field>
            <Field label="Badge URL">
              <input type="url" maxLength={500} value={form.badgeUrl} onChange={(e) => set("badgeUrl", e.target.value)} placeholder="https://…" className={inputCls} />
            </Field>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-3.5 w-3.5 rounded" />
              <span className="text-[11px] font-medium text-zinc-700">Active (shown on the landing page)</span>
            </label>
          </div>

          <SheetFooter className="border-t border-zinc-200 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300">
              {saving ? "Saving…" : item ? "Save Changes" : "Create Award"}
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {hint && <span className="ml-1 font-normal text-zinc-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
