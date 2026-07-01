"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { PlusIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon, CloudArrowUpIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  listPaymentMethods,
  createPaymentMethodWithIcon,
  updatePaymentMethodWithIcon,
  deletePaymentMethod,
  listGatewayConfigs,
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

export default function PaymentMethodsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms, adminProfile } = useAuth();
  const program = accessiblePrograms.find(
    (p) => p.programId === params.programId || p.programSlug === params.programId,
  );
  const brandId = program?.brandId ?? "";
  const userId = adminProfile?.userId ?? "";
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [activeGatewayNames, setActiveGatewayNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "MANUAL" | "AUTOMATIC">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "visible" | "hidden">("all");
  const [sortBy, setSortBy] = useState<"order-asc" | "order-desc" | "name-asc" | "name-desc">("order-asc");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentMethod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const programName = program?.programName ?? "Selected Program";

  const fetch = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true); setError(null);
    try {
      // Load methods + active gateway configs in parallel so the table can flag
      // automatic methods whose gateway provider isn't configured (which would
      // hide them from participants and fail at confirm-time).
      const [methodsData, gatewayConfigs] = await Promise.all([
        listPaymentMethods(),
        listGatewayConfigs().catch(() => []),
      ]);
      setMethods(
        methodsData.map((method) => ({
          ...method,
          type: normalizePaymentMethodType(method.type),
        })),
      );
      setActiveGatewayNames(
        new Set(gatewayConfigs.filter((c) => c.is_active).map((c) => c.provider)),
      );
    }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [params.programId]);

  useEffect(() => { fetch(); }, [fetch]);

  const filteredMethods = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...methods]
      .filter((method) => {
        const methodType = normalizePaymentMethodType(method.type);
        const gatewayActive = methodType === "MANUAL" || (method.gateway_name && activeGatewayNames.has(method.gateway_name));
        const visibleToParticipants = method.is_active && gatewayActive;
        const matchesSearch = !normalizedSearch || [
          method.display_name,
          method.name,
          method.bank_name,
          method.gateway_name,
          method.account_name,
          method.account_number,
        ].join(" ").toLowerCase().includes(normalizedSearch);
        const matchesType = typeFilter === "all" || methodType === typeFilter;
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? method.is_active : !method.is_active);
        const matchesVisibility = visibilityFilter === "all" || (visibilityFilter === "visible" ? visibleToParticipants : !visibleToParticipants);
        return matchesSearch && matchesType && matchesStatus && matchesVisibility;
      })
      .sort((left, right) => comparePaymentMethods(left, right, sortBy));
  }, [methods, activeGatewayNames, searchTerm, typeFilter, statusFilter, visibilityFilter, sortBy]);

  function resetFilters() {
    setSearchTerm("");
    setTypeFilter("all");
    setStatusFilter("all");
    setVisibilityFilter("all");
    setSortBy("order-asc");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try { await deletePaymentMethod(deleteTarget.id); toast.success("Payment method deleted."); setDeleteTarget(null); fetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleteLoading(false); }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Master Data</div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Payment Methods</h1>
        <p className="text-sm text-zinc-500">Manage accepted payment methods for this program.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">Showing {filteredMethods.length} of {methods.length} method(s)</p>
          <div className="flex gap-2">
            <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add Method</button>
          </div>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {!loading && (() => {
          const orphaned = methods.filter((m) => {
            if (normalizePaymentMethodType(m.type) !== "AUTOMATIC") return false;
            if (!m.is_active) return false;
            return !m.gateway_name || !activeGatewayNames.has(m.gateway_name);
          });
          if (orphaned.length === 0) return null;
          return (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">{orphaned.length} method{orphaned.length === 1 ? "" : "s"} hidden from participants</p>
                <p className="mt-0.5 text-amber-700">
                  Automatic methods without an active gateway config aren&apos;t shown on the participant dashboard. Configure the provider in <a href="/platform/payment-gateways" className="underline">Platform → Payment Gateways</a> or switch the method to Manual.
                </p>
              </div>
            </div>
          );
        })()}
        <div className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search method, gateway, bank, account..." className="block w-full rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="all">All types</option>
                <option value="MANUAL">Manual</option>
                <option value="AUTOMATIC">Automatic</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Visibility</label>
              <select value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value as typeof visibilityFilter)} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="all">All visibility</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="order-asc">Order: low to high</option>
                <option value="order-desc">Order: high to low</option>
                <option value="name-asc">Name: A-Z</option>
                <option value="name-desc">Name: Z-A</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={resetFilters} className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50">Reset filters</button>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="w-14 px-3 py-2 font-semibold">Icon</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Details</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Visibility</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">Loading…</td></tr>}
              {!loading && methods.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">No payment methods yet.</td></tr>}
              {!loading && methods.length > 0 && filteredMethods.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">No payment methods match the current filters.</td></tr>}
              {!loading && filteredMethods.map((m, idx) => {
                const label = m.display_name || m.name || "";
                const isManual = normalizePaymentMethodType(m.type) === "MANUAL";
                const gatewayActive = isManual || (m.gateway_name && activeGatewayNames.has(m.gateway_name));
                const visibleToParticipants = m.is_active && gatewayActive;
                return (
                <tr key={m.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2">
                    <div className="flex h-8 w-12 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white">
                      {m.icon ? (
                        <Image src={m.icon} alt={label} width={48} height={32} className="object-contain" unoptimized />
                      ) : (
                        <span className="text-[10px] font-semibold text-zinc-400">{(label.charAt(0) || "?").toUpperCase()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-900">{label || <span className="text-zinc-400">Unnamed</span>}</div>
                    {m.display_name && m.name && m.display_name !== m.name && <div className="text-[10px] text-zinc-400">{m.name}</div>}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {isManual && m.bank_name ? (
                      <div>
                        <div className="font-medium text-zinc-700">{m.bank_name}</div>
                        {m.account_number && <div className="text-[10px] text-zinc-400">{m.account_number}{m.account_name ? ` · ${m.account_name}` : ""}</div>}
                      </div>
                    ) : !isManual && m.gateway_name ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-zinc-700">{m.gateway_name}{m.gateway_type ? ` / ${m.gateway_type}` : ""}</span>
                        {!gatewayActive && (
                          <span title="No active gateway configuration for this provider" className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                            <ExclamationTriangleIcon className="h-3 w-3" />Not configured
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${isManual ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                      {isManual ? "Manual" : "Automatic"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{m.is_active ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span> : <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">Inactive</span>}</td>
                  <td className="px-3 py-2">
                    {visibleToParticipants ? (
                      <span title="Shown on the participant dashboard" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <CheckCircleIcon className="h-3 w-3" />Visible
                      </span>
                    ) : (
                      <span title={!m.is_active ? "Method is inactive" : "Gateway provider has no active configuration"} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                        <ExclamationTriangleIcon className="h-3 w-3" />Hidden
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setEditTarget(m)} className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"><PencilSquareIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setDeleteTarget(m)} className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && <PaymentMethodModal userId={userId} brandId={brandId} onClose={() => setShowCreate(false)} onSaved={fetch} />}
      {editTarget && <PaymentMethodModal method={editTarget} userId={userId} brandId={brandId} onClose={() => setEditTarget(null)} onSaved={fetch} />}
      {deleteTarget && <ConfirmDelete name={deleteTarget.display_name || deleteTarget.name} loading={deleteLoading} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
    </main>
  );
}

function PaymentMethodModal({
  method,
  userId,
  brandId,
  onClose,
  onSaved,
}: {
  method?: PaymentMethod;
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
    // `code` is a stable machine identifier. Derive it from the name on create
    // and never change it on edit — renaming a method shouldn't break anything
    // keyed off the code. A 6-char suffix keeps creates collision-resistant
    // since the column has a unique constraint.
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
      if (method) { await updatePaymentMethodWithIcon(method.id, payload); toast.success("Payment method updated."); }
      else { await createPaymentMethodWithIcon(payload); toast.success("Payment method created."); }
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
          <SheetTitle>{method ? "Edit Payment Method" : "Add Payment Method"}</SheetTitle>
          <SheetDescription>
            {method ? "Update configuration for this payment method." : "Define a new payment method and usage instructions."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
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

function ConfirmDelete({ name, loading, onCancel, onConfirm }: { name: string; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete?</h2>
        <p className="text-[11px] text-zinc-600">Remove <span className="font-semibold">{name}</span>? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">{loading ? "Deleting…" : "Delete"}</button>
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

function comparePaymentMethods(
  left: PaymentMethod,
  right: PaymentMethod,
  sortBy: "order-asc" | "order-desc" | "name-asc" | "name-desc",
): number {
  const leftLabel = left.display_name || left.name;
  const rightLabel = right.display_name || right.name;
  if (sortBy === "name-asc") return leftLabel.localeCompare(rightLabel);
  if (sortBy === "name-desc") return rightLabel.localeCompare(leftLabel);
  if (sortBy === "order-desc") return right.sort_order - left.sort_order || leftLabel.localeCompare(rightLabel);
  return left.sort_order - right.sort_order || leftLabel.localeCompare(rightLabel);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
