"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { PlusIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  listProgramFaqs,
  createProgramFaq,
  updateProgramFaq,
  deleteProgramFaq,
  type ProgramFaq,
} from "@/src/shared/api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/src/ui/sheet";
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";

const FAQ_CATEGORIES: { value: string; label: string }[] = [
  { value: "general", label: "General" },
  { value: "registration", label: "Registration" },
  { value: "payment", label: "Payment" },
  { value: "event_details", label: "Event Details" },
  { value: "accommodation", label: "Accommodation" },
  { value: "visa", label: "Visa" },
  { value: "other", label: "Other" },
];

export default function ProgramFaqsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useResolvedProgramId(params.programId);
  const [faqs, setFaqs] = useState<ProgramFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"order-asc" | "order-desc" | "question-asc" | "question-desc">("order-asc");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramFaq | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramFaq | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
  const [copyFromTemplateOpen, setCopyFromTemplateOpen] = useState(false);

  const programName =
    accessiblePrograms.find((p) => p.programId === params.programId)?.programName ?? "Selected Program";

  const load = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true); setError(null);
    try { setFaqs(await listProgramFaqs(resolvedProgramId)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [resolvedProgramId]);

  useEffect(() => { load(); }, [load]);

  const filteredFaqs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...faqs]
      .filter((faq) => {
        const matchesSearch = !normalizedSearch || [faq.question, faq.answer, faq.category ?? ""].join(" ").toLowerCase().includes(normalizedSearch);
        const matchesCategory = categoryFilter === "all" || (faq.category ?? "") === categoryFilter;
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? faq.isActive : !faq.isActive);
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((left, right) => compareFaqs(left, right, sortBy));
  }, [faqs, searchTerm, categoryFilter, statusFilter, sortBy]);

  function resetFilters() {
    setSearchTerm("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setSortBy("order-asc");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteProgramFaq(deleteTarget.id);
      toast.success("FAQ deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally { setDeleteLoading(false); }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Master Data
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} FAQs</h1>
        <p className="text-sm text-zinc-500">Configure and manage frequently asked questions for this program.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">Showing {filteredFaqs.length} of {faqs.length} FAQ(s)</p>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button
              type="button"
              onClick={() => setCopyFromProgramOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from program</span>
            </button>
            <button
              type="button"
              onClick={() => setCopyFromTemplateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from template</span>
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add FAQ</button>
          </div>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search question or answer..." className={`${inputCls} pl-8`} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputCls}>
                <option value="all">All categories</option>
                {FAQ_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={inputCls}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={inputCls}>
                <option value="order-asc">Order: low to high</option>
                <option value="order-desc">Order: high to low</option>
                <option value="question-asc">Question: A-Z</option>
                <option value="question-desc">Question: Z-A</option>
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
                <th className="w-10 px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Question</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-400">Loading…</td></tr>}
              {!loading && faqs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-400">No FAQs yet.</td></tr>}
              {!loading && faqs.length > 0 && filteredFaqs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-400">No FAQs match the current filters.</td></tr>}
              {!loading && filteredFaqs.map((f, idx) => (
                <tr key={f.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2 text-zinc-400">{f.order}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-900">{f.question}</div>
                    <div className="mt-0.5 line-clamp-1 text-zinc-500">{f.answer}</div>
                  </td>
                  <td className="px-3 py-2">
                    {f.category
                      ? <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{FAQ_CATEGORIES.find((c) => c.value === f.category)?.label ?? f.category}</span>
                      : <span className="text-zinc-400">—</span>
                    }
                  </td>
                  <td className="px-3 py-2">
                    {f.isActive
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><CheckCircleIcon className="h-3 w-3" />Active</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600"><XCircleIcon className="h-3 w-3" />Inactive</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setEditTarget(f)} className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"><PencilSquareIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setDeleteTarget(f)} className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <FaqSheet
        open={showCreate || editTarget !== null}
        programId={resolvedProgramId}
        item={editTarget ?? undefined}
        onClose={() => { setShowCreate(false); setEditTarget(null); }}
        onSaved={load}
      />

      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="faqs"
        entityLabel="FAQs"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
          load();
        }}
      />

      <CopyFromTemplateDialog
        open={copyFromTemplateOpen}
        entityKey="faqs"
        entityLabel="FAQs"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromTemplateOpen(false)}
        onApplied={() => {
          setCopyFromTemplateOpen(false);
          load();
        }}
      />

      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.question}
          loading={deleteLoading}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </main>
  );
}

function FaqSheet({
  open,
  programId,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  programId: string;
  item?: ProgramFaq;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [question, setQuestion] = useState(item?.question ?? "");
  const [answer, setAnswer] = useState(item?.answer ?? "");
  const [category, setCategory] = useState(item?.category ?? "general");
  const [order, setOrder] = useState(String(item?.order ?? "1"));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuestion(item?.question ?? "");
      setAnswer(item?.answer ?? "");
      setCategory(item?.category ?? "general");
      setOrder(String(item?.order ?? "1"));
      setIsActive(item?.isActive ?? true);
      setError(null);
    }
  }, [open, item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      if (item) {
        await updateProgramFaq(item.id, { question, answer, category, order: Number(order), isActive });
        toast.success("FAQ updated.");
      } else {
        await createProgramFaq(programId, { question, answer, category, order: Number(order) });
        toast.success("FAQ created.");
      }
      onSaved(); onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col p-0 sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-zinc-200 px-6 py-5">
            <SheetTitle>{item ? "Edit FAQ" : "Add FAQ"}</SheetTitle>
            <SheetDescription>
              {item ? "Update this frequently asked question." : "Add a new FAQ to this program."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <Field label="Question" required>
              <input required type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What is this program about?" className={inputCls} />
            </Field>
            <Field label="Answer" required>
              <textarea required rows={6} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Provide a clear and helpful answer." className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                  {FAQ_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Order">
                <input type="number" min={1} value={order} onChange={(e) => setOrder(e.target.value)} className={inputCls} />
              </Field>
            </div>
            {item && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-3.5 w-3.5 rounded" />
                <span className="text-[11px] font-medium text-zinc-700">Active</span>
              </label>
            )}
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
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
            >
              {loading ? "Saving…" : item ? "Save Changes" : "Create FAQ"}
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
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete FAQ?</h2>
        <p className="text-[11px] text-zinc-600 line-clamp-2">Remove <span className="font-semibold">&quot;{name}&quot;</span>? This cannot be undone.</p>
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

function compareFaqs(
  left: ProgramFaq,
  right: ProgramFaq,
  sortBy: "order-asc" | "order-desc" | "question-asc" | "question-desc",
): number {
  if (sortBy === "question-asc") return left.question.localeCompare(right.question);
  if (sortBy === "question-desc") return right.question.localeCompare(left.question);
  if (sortBy === "order-desc") return right.order - left.order || left.question.localeCompare(right.question);
  return left.order - right.order || left.question.localeCompare(right.question);
}
