"use client";

import { useEffect, useState, useCallback } from "react";
import { PlusIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import {
  listGatewayConfigs,
  createGatewayConfig,
  updateGatewayConfig,
  setGatewayActive,
  deleteGatewayConfig,
  SUPPORTED_GATEWAY_PROVIDERS,
  type GatewayConfig,
  type GatewayProvider,
  type GatewayMode,
  type CreateGatewayConfigInput,
} from "@/src/shared/api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/src/ui/sheet";

export default function PaymentGatewaysPage() {
  const [configs, setConfigs] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<GatewayConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GatewayConfig | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setConfigs(await listGatewayConfigs()); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleToggleActive(cfg: GatewayConfig) {
    setToggleLoadingId(cfg.id);
    try {
      await setGatewayActive(cfg.id, !cfg.is_active);
      toast.success(`${cfg.provider} ${!cfg.is_active ? "activated" : "deactivated"}.`);
      fetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle");
    } finally {
      setToggleLoadingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteGatewayConfig(deleteTarget.id);
      toast.success(`${deleteTarget.provider} config deleted.`);
      setDeleteTarget(null);
      fetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  // Group by provider so the "only one active" constraint is visually obvious.
  const grouped = configs.reduce<Record<string, GatewayConfig[]>>((acc, c) => {
    (acc[c.provider] ||= []).push(c);
    return acc;
  }, {});

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">Platform</div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">Payment Gateways</h1>
        <p className="text-sm text-zinc-500">
          Configure payment provider credentials (Midtrans, Xendit, Stripe, PayPal). Only one configuration per provider can be active at a time.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">{configs.length} configuration(s)</p>
          <div className="flex gap-2">
            <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
              <ArrowPathIcon className="h-3.5 w-3.5" />Refresh
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600">
              <PlusIcon className="h-3.5 w-3.5" />Add Gateway
            </button>
          </div>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="space-y-3">
          {loading && <p className="py-6 text-center text-xs text-zinc-400">Loading…</p>}
          {!loading && configs.length === 0 && (
            <p className="py-6 text-center text-xs text-zinc-400">No gateway configurations yet. Add one to enable automatic payment methods.</p>
          )}
          {!loading && Object.entries(grouped).map(([provider, items]) => (
            <div key={provider} className="overflow-hidden rounded-md border border-zinc-200">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700">{provider}</span>
                  <span className="text-[10px] text-zinc-500">{items.length} config(s)</span>
                </div>
              </div>
              <table className="min-w-full text-left text-[11px]">
                <thead className="bg-zinc-50/60 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Mode</th>
                    <th className="px-3 py-2 font-semibold">Brand Scope</th>
                    <th className="px-3 py-2 font-semibold">Updated</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((cfg, idx) => (
                    <tr key={cfg.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.mode === "production" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {cfg.mode}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-600 font-mono">{cfg.brand_id ?? <span className="text-zinc-400">Platform-wide</span>}</td>
                      <td className="px-3 py-2 text-zinc-500">{new Date(cfg.updated_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {cfg.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <CheckCircleIcon className="h-3 w-3" />Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">Inactive</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(cfg)}
                            disabled={toggleLoadingId === cfg.id}
                            className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition disabled:opacity-50 ${cfg.is_active ? "border-zinc-200 text-zinc-600 hover:bg-zinc-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                          >
                            {toggleLoadingId === cfg.id ? "…" : cfg.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button type="button" onClick={() => setEditTarget(cfg)} className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50">
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(cfg)} className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {showCreate && <GatewayConfigSheet onClose={() => setShowCreate(false)} onSaved={fetch} />}
      {editTarget && <GatewayConfigSheet config={editTarget} onClose={() => setEditTarget(null)} onSaved={fetch} />}
      {deleteTarget && (
        <ConfirmDelete
          label={`${deleteTarget.provider} (${deleteTarget.mode})`}
          loading={deleteLoading}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </main>
  );
}

function GatewayConfigSheet({
  config,
  onClose,
  onSaved,
}: {
  config?: GatewayConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!config;
  const [provider, setProvider] = useState<GatewayProvider>(config?.provider ?? "midtrans");
  const [mode, setMode] = useState<GatewayMode>(config?.mode ?? "sandbox");
  const [serverKey, setServerKey] = useState(config?.server_key ?? "");
  const [clientKey, setClientKey] = useState(config?.client_key ?? "");
  const [webhookSecret, setWebhookSecret] = useState(config?.webhook_secret ?? "");
  const [brandId, setBrandId] = useState(config?.brand_id ?? "");
  const [isActive, setIsActive] = useState(config?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const payload: CreateGatewayConfigInput = {
      provider,
      mode,
      server_key: serverKey,
      client_key: clientKey,
      webhook_secret: webhookSecret || undefined,
      is_active: isActive,
      brand_id: brandId.trim() || undefined,
    };
    try {
      if (isEdit && config) {
        await updateGatewayConfig(config.id, payload);
        toast.success("Gateway configuration updated.");
      } else {
        await createGatewayConfig(payload);
        toast.success("Gateway configuration created.");
      }
      onSaved(); onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col p-0 sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-zinc-200 px-6 py-5">
            <SheetTitle>{isEdit ? "Edit Gateway Configuration" : "Add Gateway Configuration"}</SheetTitle>
            <SheetDescription>
              Store provider credentials securely. Activating this config will deactivate any other active config for the same provider.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Provider" required>
                <select value={provider} onChange={(e) => setProvider(e.target.value as GatewayProvider)} className={inputCls} disabled={isEdit}>
                  {SUPPORTED_GATEWAY_PROVIDERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Mode" required>
                <select value={mode} onChange={(e) => setMode(e.target.value as GatewayMode)} className={inputCls}>
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </Field>
            </div>
            {isEdit && (
              <p className="flex items-center gap-1 text-[10px] text-zinc-500">
                <LockClosedIcon className="h-3 w-3" /> Provider can&apos;t be changed after creation. Delete and recreate if needed.
              </p>
            )}

            <Field label="Server Key" required>
              <input required type="text" value={serverKey} onChange={(e) => setServerKey(e.target.value)} placeholder={isEdit ? "(decrypted — paste new value to change)" : "Provider secret key"} className={`${inputCls} font-mono`} autoComplete="off" />
            </Field>
            <Field label="Client Key" required>
              <input required type="text" value={clientKey} onChange={(e) => setClientKey(e.target.value)} placeholder="Provider public/client key" className={`${inputCls} font-mono`} autoComplete="off" />
            </Field>
            <Field label="Webhook Secret">
              <input type="text" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="Used to verify webhook callbacks" className={`${inputCls} font-mono`} autoComplete="off" />
            </Field>

            <Field label="Brand Scope">
              <input type="text" value={brandId} onChange={(e) => setBrandId(e.target.value)} placeholder="Brand UUID — leave blank for platform-wide" className={inputCls} />
            </Field>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium text-zinc-700">Active (exclusive — other active configs for {provider} will be deactivated)</span>
            </label>
          </div>

          <SheetFooter className="border-t border-zinc-200 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-100">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60">
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Configuration"}
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ConfirmDelete({ label, loading, onCancel, onConfirm }: { label: string; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete gateway config?</h2>
        <p className="text-[11px] text-zinc-600">Remove <span className="font-semibold">{label}</span>? If any payment method still uses this provider, the request will be rejected.</p>
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
