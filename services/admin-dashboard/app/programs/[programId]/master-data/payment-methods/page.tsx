"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  type PaymentMethod,
} from "@/src/shared/api-client";

export default function PaymentMethodsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentMethod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const programName = accessiblePrograms.find((p) => p.programId === params.programId)?.programName ?? "Selected Program";

  const fetch = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true); setError(null);
    try { setMethods(await listPaymentMethods()); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [params.programId]);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try { await deletePaymentMethod(deleteTarget.id); setDeleteTarget(null); fetch(); }
    catch (err) { alert(err instanceof Error ? err.message : "Delete failed"); }
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
          <p className="text-[11px] text-zinc-500">{methods.length} method(s)</p>
          <div className="flex gap-2">
            <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add Method</button>
          </div>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-400">Loading…</td></tr>}
              {!loading && methods.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-400">No payment methods yet.</td></tr>}
              {!loading && methods.map((m, idx) => (
                <tr key={m.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2 font-medium text-zinc-900">{m.name}</td>
                  <td className="px-3 py-2 text-zinc-600 font-mono">{m.code}</td>
                  <td className="px-3 py-2 text-zinc-600">{m.type} / {m.paymentType}</td>
                  <td className="px-3 py-2">{m.isActive ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span> : <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">Inactive</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setEditTarget(m)} className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"><PencilSquareIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setDeleteTarget(m)} className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && <PaymentMethodModal onClose={() => setShowCreate(false)} onSaved={fetch} />}
      {editTarget && <PaymentMethodModal method={editTarget} onClose={() => setEditTarget(null)} onSaved={fetch} />}
      {deleteTarget && <ConfirmDelete name={deleteTarget.name} loading={deleteLoading} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
    </main>
  );
}

function PaymentMethodModal({ method, onClose, onSaved }: { programId?: string; method?: PaymentMethod; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(method?.name ?? "");
  const [code, setCode] = useState(method?.code ?? "");
  const [type, setType] = useState(method?.type ?? "bank");
  const [paymentType, setPaymentType] = useState(method?.paymentType ?? "transfer");
  const [isActive, setIsActive] = useState(method?.isActive ?? true);
  const [minAmount, setMinAmount] = useState(String(method?.minAmount ?? ""));
  const [maxAmount, setMaxAmount] = useState(String(method?.maxAmount ?? ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    const payload = { name, code, type, paymentType, isActive, minAmount: minAmount ? Number(minAmount) : undefined, maxAmount: maxAmount ? Number(maxAmount) : undefined };
    try {
      if (method) { await updatePaymentMethod(method.id, payload); }
      else { await createPaymentMethod(payload); }
      onSaved(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">{method ? "Edit Method" : "Add Payment Method"}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-zinc-400" /></button>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name" required><input required type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Code" required><input required type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. bca_va" className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type"><select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}><option value="bank">Bank</option><option value="ewallet">E-Wallet</option><option value="card">Card</option><option value="other">Other</option></select></Field>
            <Field label="Payment Type"><select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className={inputCls}><option value="transfer">Transfer</option><option value="virtual_account">Virtual Account</option><option value="credit_card">Credit Card</option><option value="qris">QRIS</option></select></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min Amount"><input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className={inputCls} /></Field>
            <Field label="Max Amount"><input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className={inputCls} /></Field>
          </div>
          <div className="flex items-center gap-2"><input id="active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-3.5 w-3.5" /><label htmlFor="active" className="text-[11px] font-medium text-zinc-700">Active</label></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">{loading ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
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
