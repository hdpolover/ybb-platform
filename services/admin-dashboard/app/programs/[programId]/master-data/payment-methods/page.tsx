"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ArrowPathIcon, ExclamationTriangleIcon, PencilSquareIcon, CloudArrowUpIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  listProgramPaymentMethods,
  bulkUpsertProgramPaymentMethods,
  listPaymentMethods,
  createPaymentMethodWithIcon,
  updatePaymentMethodWithIcon,
  deletePaymentMethod,
  listGatewayConfigs,
  type ProgramPaymentMethod,
  type ProgramMethodOverride,
  type PaymentMethod,
  type PaymentMethodType,
  type GatewayConfig,
} from "@/src/shared/api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/src/ui/sheet";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";
import { EmptyState } from "@/src/admin/empty-state";

function normalizePaymentMethodType(type: string | undefined): PaymentMethodType {
  const normalized = String(type ?? "").trim().toLowerCase();
  return normalized === "automatic" ? "AUTOMATIC" : "MANUAL";
}

function normalizeRichText(value: string): string {
  const html = value.trim();
  if (!html) return "";

  const plain = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, "")
    .trim();

  return plain ? html : "";
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Per-program override draft state ─────────────────────────────────────────
// The merged GET response only ever returns *resolved* values (override if
// present, else master) plus a has_override flag — it does not expose the raw
// master text. So each override field tracks an explicit "override this field
// for this program" toggle rather than diffing against an unknown baseline.
// Unchecked => description_override etc. is sent as null on save (clears the
// override / reverts to shared default), matching the full-replace contract.
type FieldDraft = { override: boolean; value: string };

type MethodDraft = {
  isEnabled: boolean;
  sortOrder: string;
  description: FieldDraft;
  instructions: FieldDraft;
  adminInstructions: FieldDraft;
};

function buildDraft(method: ProgramPaymentMethod): MethodDraft {
  return {
    isEnabled: method.is_enabled,
    sortOrder: String(method.sort_order),
    description: { override: method.has_description_override, value: method.description },
    instructions: { override: method.has_instructions_override, value: method.instructions },
    adminInstructions: { override: method.has_admin_instructions_override, value: method.admin_instructions },
  };
}

export default function PaymentMethodsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms, adminProfile } = useAuth();
  const program = accessiblePrograms.find(
    (p) => p.programId === params.programId || p.programSlug === params.programId,
  );
  const brandId = program?.brandId ?? "";
  const userId = adminProfile?.userId ?? "";
  const programName = program?.programName ?? "Selected Program";

  const [methods, setMethods] = useState<ProgramPaymentMethod[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MethodDraft>>({});
  const [activeGatewayNames, setActiveGatewayNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editSharedTarget, setEditSharedTarget] = useState<PaymentMethod | null>(null);
  const [editSharedLoadingId, setEditSharedLoadingId] = useState<string | null>(null);
  const [showCreateShared, setShowCreateShared] = useState(false);
  const [deleteSharedTarget, setDeleteSharedTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteSharedLoading, setDeleteSharedLoading] = useState(false);

  const fetchMethods = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true); setError(null);
    try {
      // Load the program-scoped merged list + active gateway configs in
      // parallel, same "orphaned gateway" warning as the old global screen.
      const [methodsData, gatewayConfigs] = await Promise.all([
        listProgramPaymentMethods(params.programId),
        listGatewayConfigs().catch(() => []),
      ]);
      setMethods(methodsData);
      setDrafts(Object.fromEntries(methodsData.map((m) => [m.id, buildDraft(m)])));
      setActiveGatewayNames(
        new Set(gatewayConfigs.filter((c) => c.is_active).map((c) => c.provider)),
      );
    }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load payment methods"); }
    finally { setLoading(false); }
  }, [params.programId]);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  function updateDraft(methodId: string, patch: Partial<MethodDraft>) {
    setDrafts((prev) => ({ ...prev, [methodId]: { ...prev[methodId], ...patch } }));
  }

  function updateFieldDraft(
    methodId: string,
    field: "description" | "instructions" | "adminInstructions",
    patch: Partial<FieldDraft>,
  ) {
    setDrafts((prev) => ({
      ...prev,
      [methodId]: { ...prev[methodId], [field]: { ...prev[methodId][field], ...patch } },
    }));
  }

  // Always sends the full visible set (every method on the page, not just the
  // ones touched) — this is what the fallback contract requires: a program's
  // first save must materialize the whole set, otherwise enabling/disabling
  // one method would silently drop every other method from "configured" mode.
  async function handleSaveAll() {
    if (!params.programId) return;
    setSaving(true);
    try {
      const payload: ProgramMethodOverride[] = methods.map((m) => {
        const draft = drafts[m.id] ?? buildDraft(m);
        const parsedSortOrder = Number(draft.sortOrder);
        return {
          payment_method_id: m.id,
          is_enabled: draft.isEnabled,
          sort_order: Number.isFinite(parsedSortOrder) ? parsedSortOrder : m.sort_order,
          description_override: draft.description.override ? draft.description.value : null,
          instructions_override: draft.instructions.override ? normalizeRichText(draft.instructions.value) : null,
          admin_instructions_override: draft.adminInstructions.override ? draft.adminInstructions.value : null,
        };
      });
      await bulkUpsertProgramPaymentMethods(params.programId, payload);
      toast.success("Payment method settings saved for this program.");
      // The write endpoint returns { status: "success" }, not the updated
      // list — re-fetch to pick up fresh has_*_override flags.
      await fetchMethods();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save payment method settings.");
    } finally {
      setSaving(false);
    }
  }

  // "Edit shared details" must operate on the true master record, never on
  // this page's resolved/merged values — the merged description/instructions/
  // sort_order can be a program-specific override, and the global update is a
  // full-replace, so feeding merged data back in would corrupt master data
  // shared by every other program.
  async function openEditShared(methodId: string) {
    setEditSharedLoadingId(methodId);
    try {
      const all = await listPaymentMethods();
      const master = all.find((m) => m.id === methodId);
      if (!master) { toast.error("Could not load the shared payment method record."); return; }
      setEditSharedTarget({ ...master, type: normalizePaymentMethodType(master.type) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load shared payment method.");
    } finally {
      setEditSharedLoadingId(null);
    }
  }

  // Deletes the true master record — removes this payment method from every
  // program that references it, not just {programName}. Gated behind a
  // confirm dialog opened from the "Shared Account Details" zone of a row,
  // never from the per-program controls.
  async function handleDeleteShared() {
    if (!deleteSharedTarget) return;
    setDeleteSharedLoading(true);
    try {
      await deletePaymentMethod(deleteSharedTarget.id);
      toast.success("Shared payment method deleted from all programs.");
      setDeleteSharedTarget(null);
      await fetchMethods();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete shared payment method.");
    } finally {
      setDeleteSharedLoading(false);
    }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
          This Program Only
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Payment Methods</h1>
        <p className="text-sm text-zinc-500">
          Choose which shared payment methods {programName} accepts, and optionally override the description or
          instructions shown to this program&apos;s participants. Nothing here affects any other program.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-500">
            {methods.length} method{methods.length === 1 ? "" : "s"} available
            {methods.length > 0 && !methods.some((m) => m.is_configured) && " — showing shared defaults, not yet customized for this program"}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={fetchMethods} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
              <ArrowPathIcon className="h-3.5 w-3.5" />Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreateShared(true)}
              title="Creates a shared payment method visible to ALL programs"
              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
            >
              <PlusIcon className="h-3.5 w-3.5" />Add Shared Method
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || loading || methods.length === 0}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        {loading && <p className="py-10 text-center text-xs text-zinc-400">Loading…</p>}

        {!loading && methods.length === 0 && (
          <EmptyState
            title="No shared payment methods yet"
            description="Use the 'Add Shared Method' button above to create one, then enable it for this program."
          />
        )}

        {!loading && methods.length > 0 && (
          <div className="space-y-3">
            {methods.map((m) => (
              <MethodRow
                key={m.id}
                method={m}
                draft={drafts[m.id] ?? buildDraft(m)}
                activeGatewayNames={activeGatewayNames}
                editSharedLoading={editSharedLoadingId === m.id}
                onChange={(patch) => updateDraft(m.id, patch)}
                onFieldChange={(field, patch) => updateFieldDraft(m.id, field, patch)}
                onEditShared={() => openEditShared(m.id)}
                onDeleteShared={() => setDeleteSharedTarget({ id: m.id, label: m.display_name || m.name })}
              />
            ))}
          </div>
        )}
      </section>

      {editSharedTarget && (
        <PaymentMethodModal
          method={editSharedTarget}
          programName={programName}
          userId={userId}
          brandId={brandId}
          onClose={() => setEditSharedTarget(null)}
          onSaved={fetchMethods}
        />
      )}

      {showCreateShared && (
        <PaymentMethodModal
          programName={programName}
          userId={userId}
          brandId={brandId}
          onClose={() => setShowCreateShared(false)}
          onSaved={fetchMethods}
        />
      )}

      {deleteSharedTarget && (
        <ConfirmDeleteShared
          name={deleteSharedTarget.label}
          loading={deleteSharedLoading}
          onCancel={() => setDeleteSharedTarget(null)}
          onConfirm={handleDeleteShared}
        />
      )}
    </main>
  );
}

function MethodRow({
  method,
  draft,
  activeGatewayNames,
  editSharedLoading,
  onChange,
  onFieldChange,
  onEditShared,
  onDeleteShared,
}: {
  method: ProgramPaymentMethod;
  draft: MethodDraft;
  activeGatewayNames: Set<string>;
  editSharedLoading: boolean;
  onChange: (patch: Partial<MethodDraft>) => void;
  onFieldChange: (field: "description" | "instructions" | "adminInstructions", patch: Partial<FieldDraft>) => void;
  onEditShared: () => void;
  onDeleteShared: () => void;
}) {
  const label = method.display_name || method.name || "";
  const isManual = normalizePaymentMethodType(method.type) === "MANUAL";
  const gatewayActive = isManual || (!!method.gateway_name && activeGatewayNames.has(method.gateway_name));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white">
            {method.icon ? (
              <Image src={method.icon} alt={label} width={56} height={36} className="object-contain" unoptimized />
            ) : (
              <span className="text-[10px] font-semibold text-zinc-400">{(label.charAt(0) || "?").toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">{label || <span className="text-zinc-400">Unnamed</span>}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
              <span className={`rounded px-1.5 py-0.5 font-semibold ${isManual ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                {isManual ? "Manual" : "Automatic"}
              </span>
              <span>{method.code}</span>
              {!isManual && !gatewayActive && (
                <span title="No active gateway configuration for this provider" className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-amber-700">
                  <ExclamationTriangleIcon className="h-3 w-3" />Not configured
                </span>
              )}
              {!method.is_active && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-600">Shared method inactive</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[11px] font-medium text-zinc-700">
            <input type="checkbox" checked={draft.isEnabled} onChange={(e) => onChange({ isEnabled: e.target.checked })} className="h-3.5 w-3.5" />
            Enabled for this program
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
            Order
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => onChange({ sortOrder: e.target.value })}
              className="w-16 rounded-md border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">This Program</p>
          <OverrideField
            label="Description"
            field={draft.description}
            wasOverridden={method.has_description_override}
            onChange={(patch) => onFieldChange("description", patch)}
            renderInput={(value, onValueChange) => (
              <textarea rows={2} value={value} onChange={(e) => onValueChange(e.target.value)} className={inputCls} />
            )}
          />
          <OverrideField
            label="Customer Instructions"
            field={draft.instructions}
            wasOverridden={method.has_instructions_override}
            onChange={(patch) => onFieldChange("instructions", patch)}
            renderInput={(value, onValueChange) => (
              <RichTextEditor
                content={value}
                onChange={onValueChange}
                placeholder="Shown to the payer"
                className="[&_.ProseMirror]:min-h-[100px]"
              />
            )}
          />
          <OverrideField
            label="Admin Instructions"
            field={draft.adminInstructions}
            wasOverridden={method.has_admin_instructions_override}
            onChange={(patch) => onFieldChange("adminInstructions", patch)}
            renderInput={(value, onValueChange) => (
              <textarea rows={2} value={value} onChange={(e) => onValueChange(e.target.value)} placeholder="Internal — shown only to admins" className={inputCls} />
            )}
          />
        </div>

        <div className="space-y-2 rounded-md border border-zinc-100 bg-zinc-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Shared Account Details</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onEditShared}
                disabled={editSharedLoading}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
              >
                <PencilSquareIcon className="h-3 w-3" />{editSharedLoading ? "Loading…" : "Edit shared details"}
              </button>
              <button
                type="button"
                onClick={onDeleteShared}
                title="Delete this shared payment method for ALL programs"
                className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-white px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50"
              >
                <TrashIcon className="h-3 w-3" />Delete
              </button>
            </div>
          </div>
          {isManual ? (
            <dl className="space-y-1 text-[11px] text-zinc-600">
              <div className="flex justify-between gap-2"><dt className="text-zinc-400">Bank</dt><dd className="font-medium text-zinc-700">{method.bank_name || "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-zinc-400">Account Number</dt><dd className="font-medium text-zinc-700">{method.account_number || "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-zinc-400">Account Name</dt><dd className="font-medium text-zinc-700">{method.account_name || "—"}</dd></div>
            </dl>
          ) : (
            <dl className="space-y-1 text-[11px] text-zinc-600">
              <div className="flex justify-between gap-2"><dt className="text-zinc-400">Gateway</dt><dd className="font-medium text-zinc-700">{method.gateway_name || "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-zinc-400">Channel</dt><dd className="font-medium text-zinc-700">{method.gateway_type || "—"}</dd></div>
            </dl>
          )}
          <p className="pt-1 text-[10px] text-zinc-400">Read-only here — bank and gateway details are shared across every program.</p>
        </div>
      </div>
    </div>
  );
}

function OverrideField({
  label,
  field,
  wasOverridden,
  onChange,
  renderInput,
}: {
  label: string;
  field: FieldDraft;
  wasOverridden: boolean;
  onChange: (patch: Partial<FieldDraft>) => void;
  renderInput: (value: string, onValueChange: (value: string) => void) => React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium text-zinc-700">{label}</label>
          {field.override && (
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-700">
              Program-specific
            </span>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500">
          <input
            type="checkbox"
            checked={field.override}
            onChange={(e) => onChange({ override: e.target.checked })}
            className="h-3 w-3"
          />
          Override for this program
        </label>
      </div>
      {field.override ? (
        renderInput(field.value, (value) => onChange({ value }))
      ) : wasOverridden ? (
        <p className="rounded-md border border-dashed border-amber-200 bg-amber-50/50 px-3 py-2 text-[11px] text-amber-700">
          Will revert to the shared default when you save.
        </p>
      ) : (
        <p className="rounded-md border border-dashed border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-400">
          Using shared default{field.value ? `: "${stripHtml(field.value).slice(0, 140)}"` : " (empty)"}
        </p>
      )}
    </div>
  );
}

// ─── Shared (global) payment method create/edit modal ─────────────────────────
// Creates or edits the master payment_methods row directly (bank/account/
// gateway/icon/fee config, plus the master copy of description/instructions/
// sort_order). Reachable via "Add Shared Method" (create, `method` omitted)
// or "Edit shared details" (edit, `method` provided) — always carries a
// warning that the change is global, not scoped to the program the admin
// came from.
function PaymentMethodModal({
  method,
  programName,
  userId,
  brandId,
  onClose,
  onSaved,
}: {
  method?: PaymentMethod;
  programName: string;
  userId: string;
  brandId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(method?.name ?? "");
  const [type, setType] = useState<PaymentMethodType>(normalizePaymentMethodType(method?.type));
  const [displayName, setDisplayName] = useState(method?.display_name ?? "");
  const [description, setDescription] = useState(method?.description ?? "");
  const [isActive, setIsActive] = useState(method?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(String(method?.sort_order ?? ""));

  // MANUAL fields
  const [bankName, setBankName] = useState(method?.bank_name ?? "");
  const [accountNumber, setAccountNumber] = useState(method?.account_number ?? "");
  const [accountName, setAccountName] = useState(method?.account_name ?? "");
  const [instructions, setInstructions] = useState(method?.instructions ?? "");
  const [requiresProof, setRequiresProof] = useState(method?.requires_proof ?? false);
  const [adminInstructions, setAdminInstructions] = useState(method?.admin_instructions ?? "");

  // AUTOMATIC fields — populated from the gateway-configs list once loaded.
  const [gatewayName, setGatewayName] = useState(method?.gateway_name ?? "");
  const [gatewayType, setGatewayType] = useState(method?.gateway_type ?? "");
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(true);

  // Gateway fee config. `percentageFeeDisplay` is shown to admins as a PERCENT
  // (e.g. "3.219" = 3.219%); the DB stores it as a fraction (0.03219). Convert
  // on load (× 100) and on submit (÷ 100) — see handleSubmit.
  const [percentageFeeDisplay, setPercentageFeeDisplay] = useState(
    method?.config?.percentage_fee != null
      // Round to 6dp to absorb float noise from the ×100 conversion (e.g.
      // 0.03219 * 100 === 3.2189999999999994 without this).
      ? String(Number((method.config.percentage_fee * 100).toFixed(6)))
      : "0",
  );
  const [fixedFee, setFixedFee] = useState(String(method?.config?.fixed_fee ?? 0));
  const [minFee, setMinFee] = useState(String(method?.config?.min_fee ?? 0));
  const [feeCurrency, setFeeCurrency] = useState(method?.config?.currency || "IDR");
  const [isSurcharge, setIsSurcharge] = useState(method?.config?.is_surcharge ?? false);

  // Icon upload
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => { if (iconPreview) URL.revokeObjectURL(iconPreview); }, [iconPreview]);

  // Fetch active gateway providers once — only needed for AUTOMATIC methods.
  useEffect(() => {
    let cancelled = false;
    setGatewaysLoading(true);
    listGatewayConfigs()
      .then((all) => { if (!cancelled) setGateways(all.filter((c) => c.is_active)); })
      .catch((err) => { if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load gateways"); })
      .finally(() => { if (!cancelled) setGatewaysLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const existingIcon = method?.icon || null;
  const previewSrc = iconPreview ?? existingIcon;

  function pickFile(file: File | null) {
    if (!file) { setIconFile(null); setIconPreview(null); return; }
    if (!file.type.startsWith("image/")) { setError("Icon must be an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Icon must be 2MB or smaller."); return; }
    setError(null);
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    pickFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    // `code` is a stable machine identifier. Derive it from the name on
    // create and never change it on edit — renaming a method shouldn't break
    // anything keyed off the code. A random suffix keeps creates
    // collision-resistant since the column has a unique constraint.
    const code = method?.code ?? `${slugify(name)}_${Math.random().toString(36).slice(2, 8)}`;
    if (!code) { setError("Internal name is required to generate a code."); setLoading(false); return; }
    // AUTOMATIC methods must point at a real active gateway — otherwise the
    // payment service would fail at charge time with "no active config".
    // Hard-block this on save (and especially on activation) so admins are
    // forced to configure the provider before participants ever see the option.
    if (type === "AUTOMATIC") {
      if (!gatewayName) {
        const msg = gateways.length === 0
          ? "No active payment gateways configured. Add one in Platform → Payment Gateways first."
          : "Select a payment gateway for automatic methods.";
        setError(msg); toast.error(msg); setLoading(false); return;
      }
      const providerActive = gateways.some((g) => g.provider === gatewayName);
      if (isActive && !providerActive) {
        const msg = `Cannot activate this method — the gateway provider "${gatewayName}" has no active configuration. Configure it in Platform → Payment Gateways first.`;
        setError(msg); toast.error(msg); setLoading(false); return;
      }
    }
    // Gateway fee config — validate the admin-facing percent value (0-100) and
    // the currency amounts (non-negative) before converting to the fraction
    // the API expects.
    const parsedPercent = Number(percentageFeeDisplay);
    const parsedFixedFee = Number(fixedFee);
    const parsedMinFee = Number(minFee);
    if (type === "AUTOMATIC") {
      if (!Number.isFinite(parsedPercent) || parsedPercent < 0 || parsedPercent > 100) {
        const msg = "Percentage fee must be a number between 0 and 100.";
        setError(msg); toast.error(msg); setLoading(false); return;
      }
      if (!Number.isFinite(parsedFixedFee) || parsedFixedFee < 0) {
        const msg = "Fixed fee cannot be negative.";
        setError(msg); toast.error(msg); setLoading(false); return;
      }
      if (!Number.isFinite(parsedMinFee) || parsedMinFee < 0) {
        const msg = "Minimum fee cannot be negative.";
        setError(msg); toast.error(msg); setLoading(false); return;
      }
    }
    // Build payload matching the Go entity. Empty strings are sent rather than
    // omitted so that clearing a field on edit actually removes the old value.
    const payload: Partial<PaymentMethod> & { name: string; code: string; iconFile?: File; userId?: string; brandId?: string } = {
      name,
      code,
      type,
      display_name: displayName || name,
      description,
      is_active: isActive,
      sort_order: sortOrder ? Number(sortOrder) : 0,
      // Preserve the existing icon URL; the wrapper overwrites it when a new
      // file is uploaded. The Go update handler unconditionally overwrites Icon,
      // so omitting this field on edit would clear a previously-set icon.
      icon: method?.icon ?? "",
      bank_name: type === "MANUAL" ? bankName : "",
      account_number: type === "MANUAL" ? accountNumber : "",
      account_name: type === "MANUAL" ? accountName : "",
      instructions: type === "MANUAL" ? normalizeRichText(instructions) : "",
      requires_proof: type === "MANUAL" ? requiresProof : false,
      admin_instructions: type === "MANUAL" ? adminInstructions : "",
      gateway_name: type === "AUTOMATIC" ? gatewayName : "",
      gateway_type: type === "AUTOMATIC" ? gatewayType : "",
      // Always send a full config object — like `icon` above, the Go update
      // handler unconditionally overwrites Config with whatever is in the
      // request body, so omitting it on edit would silently zero out
      // previously-saved fee settings.
      config: {
        fixed_fee: Number.isFinite(parsedFixedFee) ? parsedFixedFee : 0,
        // toFixed(6) absorbs binary float noise from the ÷100 conversion
        // (e.g. 3.219 / 100 === 0.032189999999999996 without it).
        percentage_fee: Number.isFinite(parsedPercent) ? Number((parsedPercent / 100).toFixed(6)) : 0,
        min_fee: Number.isFinite(parsedMinFee) ? parsedMinFee : 0,
        currency: feeCurrency || "IDR",
        is_surcharge: isSurcharge,
      },
    };
    if (iconFile) {
      if (!userId || !brandId) { setError("Cannot upload icon: missing user or brand context."); setLoading(false); return; }
      payload.iconFile = iconFile;
      payload.userId = userId;
      payload.brandId = brandId;
    }
    try {
      if (method) {
        await updatePaymentMethodWithIcon(method.id, payload);
        toast.success("Shared payment method updated.");
      } else {
        await createPaymentMethodWithIcon(payload);
        toast.success("Shared payment method created.");
      }
      onSaved(); onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
      toast.error(msg);
    }
    finally { setLoading(false); }
  }

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col p-0 sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <SheetHeader className="border-b border-zinc-200 px-6 py-5">
          <SheetTitle>{method ? "Edit Shared Payment Method" : "Add Shared Payment Method"}</SheetTitle>
          <SheetDescription>
            {method
              ? "Update the shared account/gateway record used across every program."
              : "Create a shared account/gateway record available to every program."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This is <span className="font-semibold">shared master data</span> —{" "}
              {method ? (
                <>saving here changes this payment method for <span className="font-semibold">every program</span> that uses it, not just {programName}.</>
              ) : (
                <>creating here adds a payment method visible to <span className="font-semibold">every program</span>, not just {programName}.</>
              )}
            </p>
          </div>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <Field label="Internal Name" required><input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bank BCA" className={inputCls} /></Field>
          <Field label="Display Name"><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="User-facing name (defaults to Internal Name)" className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" required>
              <select value={type} onChange={(e) => setType(e.target.value as PaymentMethodType)} className={inputCls}>
                <option value="MANUAL">Manual</option>
                <option value="AUTOMATIC">Automatic</option>
              </select>
            </Field>
            <Field label="Sort Order"><input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="0" className={inputCls} /></Field>
          </div>
          <Field label="Description"><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></Field>

          {type === "MANUAL" && (
            <div className="space-y-3 rounded-md border border-zinc-100 bg-zinc-50/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Manual Transfer Details</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank Name"><input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. BCA" className={inputCls} /></Field>
                <Field label="Account Number"><input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Account Name"><input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} className={inputCls} /></Field>
              <Field label="Customer Instructions">
                <RichTextEditor
                  content={instructions}
                  onChange={setInstructions}
                  placeholder="Shown to the payer"
                  className="[&_.ProseMirror]:min-h-[140px]"
                />
              </Field>
              <Field label="Admin Instructions"><textarea rows={2} value={adminInstructions} onChange={(e) => setAdminInstructions(e.target.value)} placeholder="Internal — shown only to admins" className={inputCls} /></Field>
              <label className="flex items-center gap-2"><input type="checkbox" checked={requiresProof} onChange={(e) => setRequiresProof(e.target.checked)} className="h-3.5 w-3.5" /><span className="text-[11px] font-medium text-zinc-700">Requires proof of payment</span></label>
            </div>
          )}

          {type === "AUTOMATIC" && (
            <div className="space-y-3 rounded-md border border-zinc-100 bg-zinc-50/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Gateway Details</p>
              {gatewaysLoading ? (
                <p className="text-[11px] text-zinc-500">Loading gateways…</p>
              ) : gateways.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  <p className="font-semibold">No active payment gateway configurations</p>
                  <p className="mt-0.5">
                    Automatic methods need a working provider. Add or activate one in{" "}
                    <a href="/platform/payment-gateways" className="font-semibold underline">Platform → Payment Gateways</a>{" "}
                    before saving this method as Active.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Gateway Provider" required>
                      <select
                        required
                        value={gatewayName}
                        onChange={(e) => setGatewayName(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Select provider…</option>
                        {gateways.map((g) => (
                          <option key={g.id} value={g.provider}>
                            {g.provider} ({g.mode})
                          </option>
                        ))}
                        {gatewayName && !gateways.some((g) => g.provider === gatewayName) && (
                          <option value={gatewayName} disabled>
                            {gatewayName} (no active config)
                          </option>
                        )}
                      </select>
                    </Field>
                    <Field label="Channel / Type">
                      <input type="text" value={gatewayType} onChange={(e) => setGatewayType(e.target.value)} placeholder="e.g. snap, credit_card, qris" className={inputCls} />
                    </Field>
                  </div>
                  {gatewayName && !gateways.some((g) => g.provider === gatewayName) && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      <p className="font-semibold">Provider &quot;{gatewayName}&quot; has no active configuration</p>
                      <p className="mt-0.5">
                        This method will be hidden from participants until the provider is activated. Configure it in{" "}
                        <a href="/platform/payment-gateways" className="font-semibold underline">Platform → Payment Gateways</a>{" "}
                        or pick a different provider above.
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Gateway Fee</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                    Enter the effective rate including any VAT/PPN. Surcharge on: participant pays the fee on top. Surcharge off: you absorb it (net = amount minus fee).
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Percentage Fee (%)">
                    <input type="number" step="0.001" min={0} max={100} value={percentageFeeDisplay} onChange={(e) => setPercentageFeeDisplay(e.target.value)} placeholder="e.g. 3.219" className={inputCls} />
                  </Field>
                  <Field label="Fixed Fee">
                    <input type="number" step="0.01" min={0} value={fixedFee} onChange={(e) => setFixedFee(e.target.value)} placeholder="e.g. 2220" className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Minimum Fee">
                    <input type="number" step="0.01" min={0} value={minFee} onChange={(e) => setMinFee(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Currency">
                    <input type="text" value={feeCurrency} onChange={(e) => setFeeCurrency(e.target.value.toUpperCase())} placeholder="IDR" className={inputCls} />
                  </Field>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isSurcharge} onChange={(e) => setIsSurcharge(e.target.checked)} className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium text-zinc-700">Pass fee to participant (surcharge)</span>
                </label>
              </div>
            </div>
          )}

          <Field label="Icon">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              className="flex min-h-[88px] cursor-pointer items-center gap-3 rounded-md border-2 border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600 transition hover:border-blue-400 hover:bg-blue-50/30"
            >
              {previewSrc ? (
                <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white">
                  <Image src={previewSrc} alt="Icon preview" width={80} height={56} className="object-contain" unoptimized />
                </div>
              ) : (
                <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-400">
                  <CloudArrowUpIcon className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-[11px] font-semibold text-zinc-700">
                  {iconFile ? iconFile.name : existingIcon ? "Current icon (drop or click to replace)" : "Drop image or click to upload"}
                </p>
                <p className="text-[10px] text-zinc-400">PNG, JPG, GIF, WEBP — max 2MB.</p>
                {iconFile && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); pickFile(null); }}
                    className="text-[10px] font-medium text-red-500 hover:underline"
                  >
                    Remove selected file
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <label className="flex items-center gap-2"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-3.5 w-3.5" /><span className="text-[11px] font-medium text-zinc-700">Active</span></label>
        </div>

        <SheetFooter className="border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
          >
            {loading ? "Saving…" : method ? "Save Changes" : "Create Method"}
          </button>
        </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Shared (global) delete confirmation ───────────────────────────────────
// Deletes the master record — explicitly warns this removes the method from
// every program, not just the one the admin is currently viewing.
function ConfirmDeleteShared({
  name,
  loading,
  onCancel,
  onConfirm,
}: {
  name: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete shared payment method?</h2>
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Removing <span className="font-semibold">{name}</span> deletes it from{" "}
            <span className="font-semibold">every program</span> that uses it, not just this one. This cannot be
            undone.
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">{loading ? "Deleting…" : "Delete for all programs"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-700">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>
      {children}
    </div>
  );
}

const inputCls = "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

// Derives a stable machine `code` from the admin-entered name when creating
// a new shared payment method (edits keep the original code untouched).
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
