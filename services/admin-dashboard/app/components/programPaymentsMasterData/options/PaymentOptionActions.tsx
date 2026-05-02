"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/solid";
import type { PaymentOptionRow } from "./PaymentOptionTable";
import { createPricingTier, updatePricingTier, deletePricingTier } from "@/app/platform/api";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";
import { toUtcIsoFromLocalInput } from "@/lib/utils";

// SEARCH COMPONENT
export function PaymentOptionSearch({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchTerm) {
        params.set("search", searchTerm);
      } else {
        params.delete("search");
      }
      router.push(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, pathname, router, searchParams]);

  return (
    <div className="w-full">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search by name, category..."
        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// FORM DRAWER COMPONENT (Internal)
function PaymentOptionDrawer({
  isOpen,
  onClose,
  onSaved,
  initialData,
  programId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialData?: PaymentOptionRow;
  programId?: string;
}) {
  const isEditMode = !!initialData;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(initialData?.description ?? "");

  useEffect(() => {
    if (!isOpen) return;
    setDescription(initialData?.description ?? "");
  }, [initialData, isOpen]);

  const feeTypeValue =
    initialData?.category === "Registration Fee" ? "registration_fee" :
    initialData?.category === "Program Fee 2" ? "program_fee_2" : "program_fee_1";
  const allowedCatsValue = (() => {
    if (!initialData) return "self_funded,fully_funded";
    if (initialData.fundingType === "Self Funded") return "self_funded";
    if (initialData.fundingType === "Fully Funded") return "fully_funded";
    return "self_funded,fully_funded";
  })();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const name = (fd.get("name") as string).trim();
    const price = parseFloat(fd.get("price") as string);
    const currency = fd.get("currency") as string;
    const feeType = fd.get("feeType") as string;
    const allowedCategoriesRaw = fd.get("allowedCategories") as string;
    const isActive = fd.get("isActive") === "true";
    const validFrom = fd.get("validFrom") as string | null;
    const validUntil = fd.get("validUntil") as string | null;
    const benefitsRaw = (fd.get("benefits") as string ?? "").trim();
    const requirementsRaw = (fd.get("requirements") as string ?? "").trim();
    const allowedCategories = allowedCategoriesRaw
      ? allowedCategoriesRaw.split(",").map((c) => c.trim())
      : [];
    const benefits = benefitsRaw ? benefitsRaw.split("\n").map((s) => s.trim()).filter(Boolean) : [];
    const requirements = requirementsRaw ? requirementsRaw.split("\n").map((s) => s.trim()).filter(Boolean) : [];
    const descriptionToSave = description.trim();

    setSaving(true);
    setError(null);
    try {
      const validFromUtc = toUtcIsoFromLocalInput(validFrom);
      const validUntilUtc = toUtcIsoFromLocalInput(validUntil);

        if (isEditMode && initialData) {
          await updatePricingTier(initialData._id, {
          name, description: descriptionToSave, price, currency, feeType, allowedCategories, isActive, benefits, requirements,
          ...(validFromUtc ? { validFrom: validFromUtc } : {}),
          ...(validUntilUtc ? { validUntil: validUntilUtc } : {}),
        });
      } else {
        if (!programId) throw new Error("Program ID is required");
        if (!validFromUtc || !validUntilUtc) throw new Error("Valid From and Valid Until are required");
        await createPricingTier(programId, {
          name, description: descriptionToSave, price, currency, feeType, allowedCategories, benefits, requirements, validFrom: validFromUtc, validUntil: validUntilUtc,
        });
      }
      onClose();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="payment-option-form"
        disabled={saving}
        className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
      >
        {saving ? "Saving…" : isEditMode ? "Save Changes" : "Add Option"}
      </button>
    </>
  );

  return (
    <DrawerShell
      open={isOpen}
      onClose={onClose}
      title={isEditMode ? "Edit Payment Option" : "Add Payment Option"}
      description="Configure payment amount, funding type, and status."
      error={error}
      footer={footer}
      locked={saving}
    >
      <form id="payment-option-form" className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Option Name</label>
            <input name="name" type="text" defaultValue={initialData?.optionName} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Fee Type</label>
            <select name="feeType" defaultValue={feeTypeValue} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="registration_fee">Registration Fee</option>
              <option value="program_fee_1">Program Fee 1</option>
              <option value="program_fee_2">Program Fee 2</option>
            </select>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Allowed Categories</label>
            <select name="allowedCategories" defaultValue={allowedCatsValue} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="self_funded,fully_funded">All</option>
              <option value="self_funded">Self Funded</option>
              <option value="fully_funded">Fully Funded</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">USD Amount</label>
            <input name="price" type="number" step="0.01" defaultValue={initialData?.amountUsd} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Currency</label>
            <select name="currency" defaultValue="USD" className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="USD">USD</option>
              <option value="IDR">IDR</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description</label>
          <RichTextEditor
            content={description}
            onChange={setDescription}
            placeholder="Shown on registration cards before requirements."
            className="[&_.ProseMirror]:min-h-[120px]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Requirements</label>
          <p className="mb-2 text-xs text-zinc-400">One requirement per line. Shown on the registration page.</p>
          <textarea
            name="requirements"
            rows={4}
            defaultValue={(initialData?.requirements ?? []).join("\n")}
            placeholder={"Complete registration form\nSubmit required documents on time"}
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Benefits</label>
          <p className="mb-2 text-xs text-zinc-400">One benefit per line. Shown on the registration page.</p>
          <textarea
            name="benefits"
            rows={4}
            defaultValue={(initialData?.benefits ?? []).join("\n")}
            placeholder={"Guaranteed program participation\nFaster application processing"}
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {isEditMode && (
          <div className="w-48">
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status</label>
            <select name="isActive" defaultValue={initialData?.status !== "Inactive" ? "true" : "false"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        )}

        {/* Create: always show period dates. Edit: only if periods already exist */}
        {(!isEditMode || initialData?.currentActivePeriodRange || initialData?.lastActivePeriodRange) && (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                Valid From {!isEditMode && <span className="text-rose-500">*</span>}
              </label>
              <input name="validFrom" type="datetime-local" className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required={!isEditMode} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                Valid Until {!isEditMode && <span className="text-rose-500">*</span>}
              </label>
              <input name="validUntil" type="datetime-local" className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required={!isEditMode} />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-amber-500" />
            <p className="text-xs text-zinc-700">
              {isEditMode
                ? "Fine-grained wave periods are managed from the Periods page for this option."
                : "Valid From / Until sets the initial active window. Add more wave periods from the Periods page after saving."}
            </p>
          </div>
        </div>
      </form>
    </DrawerShell>
  );
}

// EXPORTED ACTION BUTTONS
export function AddPaymentOptionAction({
  programId,
  onSaved,
}: {
  programId?: string;
  onSaved?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Payment Option</span>
      </button>
      <PaymentOptionDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} onSaved={onSaved} programId={programId} />
    </>
  );
}

export function ManagePeriodsAction({ optionId }: { optionId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <button
      type="button"
      onClick={() => router.push(`${pathname}/${optionId}`)}
      className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-600 transition hover:bg-sky-100 hover:text-sky-700"
      title="Manage Periods"
    >
      <CalendarDaysIcon className="h-4 w-4" />
    </button>
  );
}

export function EditPaymentOptionAction({
  option,
  onSaved,
}: {
  option: PaymentOptionRow;
  onSaved?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
        title="Edit Option"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <PaymentOptionDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} onSaved={onSaved} initialData={option} />
    </>
  );
}

export function DeletePaymentOptionAction({
  id,
  onDeleted,
}: {
  id: string;
  onDeleted?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePricingTier(id);
      onDeleted?.();
    } catch {
      // silent
    } finally {
      setDeleting(false);
      setConfirm(false);
    }
  };

  if (confirm) {
    return (
      <div className="inline-flex items-center gap-1">
        <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-md bg-rose-500 px-2 py-1 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60">
          {deleting ? "…" : "Confirm"}
        </button>
        <button type="button" onClick={() => setConfirm(false)} className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700"
      title="Delete Option"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
