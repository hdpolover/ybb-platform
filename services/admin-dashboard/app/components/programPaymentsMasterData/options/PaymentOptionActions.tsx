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
import { convertUsdToIdr } from "@/src/shared/money";

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

// DUAL PRICING BLOCK (Internal)
// Renders the two-input pricing block (USD gateway + IDR manual transfer) with
// auto-fill from the program exchange rate and a soft >10% divergence warning.
// The inputs use plain `name` attributes so the parent's FormData submit handler
// can read them — internal `useState` only powers the live conversion + warning UI.
function DualPricingBlock({
  initialUsdPrice,
  initialIdrPrice,
  programUsdInIdr,
}: {
  initialUsdPrice: number;
  initialIdrPrice: number;
  programUsdInIdr: number | null;
}) {
  const [usdPrice, setUsdPrice] = useState<number>(initialUsdPrice);
  const [idrPrice, setIdrPrice] = useState<number>(initialIdrPrice);

  // Re-sync when initial values change (drawer reopens for a different row).
  useEffect(() => {
    setUsdPrice(initialUsdPrice);
    setIdrPrice(initialIdrPrice);
  }, [initialUsdPrice, initialIdrPrice]);

  const expectedIdr =
    programUsdInIdr && usdPrice > 0 ? convertUsdToIdr(usdPrice, programUsdInIdr) : 0;
  const divergencePct =
    expectedIdr > 0 ? ((idrPrice - expectedIdr) / expectedIdr) * 100 : 0;
  const showDivergenceWarning =
    expectedIdr > 0 && idrPrice > 0 && Math.abs(divergencePct) > 10;

  const handleAutoFillIdr = () => {
    if (programUsdInIdr && usdPrice > 0) setIdrPrice(expectedIdr);
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pricing</p>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">
            Gateway price (USD) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
            <input
              name="usdPrice"
              type="number"
              step="0.01"
              min="0.01"
              value={Number.isFinite(usdPrice) && usdPrice > 0 ? usdPrice : ""}
              onChange={(e) => setUsdPrice(parseFloat(e.target.value) || 0)}
              className="block w-full rounded-md border border-zinc-200 bg-white py-2 pl-7 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>
          <p className="mt-1 text-xs text-zinc-400">Used for automatic payment gateway</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">
            Manual transfer (IDR) <span className="text-rose-500">*</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">Rp</span>
              <input
                name="idrPrice"
                type="number"
                step="1000"
                min="1"
                value={Number.isFinite(idrPrice) && idrPrice > 0 ? idrPrice : ""}
                onChange={(e) => setIdrPrice(parseInt(e.target.value, 10) || 0)}
                className="block w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>
            <button
              type="button"
              onClick={handleAutoFillIdr}
              disabled={!programUsdInIdr || usdPrice <= 0}
              title="Auto-fill IDR from USD × current exchange rate"
              aria-label="Auto-fill IDR price from USD price using the current exchange rate"
              className="rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40"
            >
              ↻
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-400">Used for manual bank transfer</p>
        </div>
      </div>

      {programUsdInIdr ? (
        <div className="space-y-1 text-xs text-zinc-500">
          <p>
            Current exchange rate: 1 USD ={" "}
            {new Intl.NumberFormat("id-ID").format(programUsdInIdr)} IDR
          </p>
          {usdPrice > 0 && idrPrice > 0 && (
            <p>
              At this rate, ${usdPrice.toFixed(2)} ≈ Rp{" "}
              {new Intl.NumberFormat("id-ID").format(expectedIdr)}. You set Rp{" "}
              {new Intl.NumberFormat("id-ID").format(idrPrice)} (
              {divergencePct >= 0 ? "+" : ""}
              {divergencePct.toFixed(1)}%).
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-amber-600">
          ⚠ Program exchange rate is not set — auto-fill is disabled.
        </p>
      )}

      {showDivergenceWarning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          ⓘ Manual price differs from converted USD by{" "}
          {Math.abs(divergencePct).toFixed(1)}%. Save anyway if intentional.
        </div>
      )}
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
  programUsdInIdr,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialData?: PaymentOptionRow;
  programId?: string;
  programUsdInIdr: number | null;
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
    const usdPrice = parseFloat(fd.get("usdPrice") as string);
    const idrPrice = parseInt(fd.get("idrPrice") as string, 10);
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

    if (!Number.isFinite(usdPrice) || usdPrice <= 0) {
      setError("USD price must be a positive number");
      return;
    }
    if (!Number.isInteger(idrPrice) || idrPrice <= 0) {
      setError("IDR price must be a positive whole number");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const validFromUtc = toUtcIsoFromLocalInput(validFrom);
      const validUntilUtc = toUtcIsoFromLocalInput(validUntil);

      if (isEditMode && initialData) {
        await updatePricingTier(initialData._id, {
          name, description: descriptionToSave, usdPrice, idrPrice, feeType, allowedCategories, isActive, benefits, requirements,
          ...(validFromUtc ? { validFrom: validFromUtc } : {}),
          ...(validUntilUtc ? { validUntil: validUntilUtc } : {}),
        });
      } else {
        if (!programId) throw new Error("Program ID is required");
        if (!validFromUtc || !validUntilUtc) throw new Error("Valid From and Valid Until are required");
        await createPricingTier(programId, {
          name, description: descriptionToSave, usdPrice, idrPrice, feeType, allowedCategories, benefits, requirements, validFrom: validFromUtc, validUntil: validUntilUtc,
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

        <div className="md:w-1/2">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Allowed Categories</label>
          <select name="allowedCategories" defaultValue={allowedCatsValue} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            <option value="self_funded,fully_funded">All</option>
            <option value="self_funded">Self Funded</option>
            <option value="fully_funded">Fully Funded</option>
          </select>
        </div>

        <DualPricingBlock
          initialUsdPrice={initialData?.usdPrice ?? 0}
          initialIdrPrice={initialData?.idrPrice ?? 0}
          programUsdInIdr={programUsdInIdr}
        />

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
  programUsdInIdr,
  onSaved,
}: {
  programId?: string;
  programUsdInIdr: number | null;
  onSaved?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Payment Option</span>
      </button>
      <PaymentOptionDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSaved={onSaved}
        programId={programId}
        programUsdInIdr={programUsdInIdr}
      />
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
  programUsdInIdr,
  onSaved,
}: {
  option: PaymentOptionRow;
  programUsdInIdr: number | null;
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
      <PaymentOptionDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSaved={onSaved}
        initialData={option}
        programUsdInIdr={programUsdInIdr}
      />
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
