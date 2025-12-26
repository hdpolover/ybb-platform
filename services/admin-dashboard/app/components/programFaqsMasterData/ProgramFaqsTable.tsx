"use client";

import { useState } from "react";
import {
  CheckCircleIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

export type FaqStatus = "Active" | "Inactive";

export type FaqCategory = "Basic" | "Event Details" | "Registration" | "Payments";

export type ProgramFaq = {
  id: number;
  order: number;
  question: string;
  answer: string;
  category: FaqCategory;
  status: FaqStatus;
};

const mockFaqs: ProgramFaq[] = [
  {
    id: 1,
    order: 1,
    question: "What is this program about?",
    answer:
      "This program is designed to connect young leaders around the world through experiential learning, cultural exchange, and social impact projects.",
    category: "Basic",
    status: "Active",
  },
  {
    id: 2,
    order: 2,
    question: "Where will the event take place?",
    answer:
      "The event will be held in a hybrid format with main activities in Jakarta, Indonesia, and selected sessions online.",
    category: "Event Details",
    status: "Active",
  },
  {
    id: 3,
    order: 3,
    question: "How do I complete my registration?",
    answer:
      "After being accepted, you will receive an email with a registration link. Complete the form and upload all required documents before the deadline.",
    category: "Registration",
    status: "Active",
  },
  {
    id: 4,
    order: 4,
    question: "What payment methods are available?",
    answer:
      "You can pay using bank transfer, virtual account, or international credit/debit card depending on your country.",
    category: "Payments",
    status: "Inactive",
  },
];

function getCategoryBadgeClass(category: FaqCategory): string {
  switch (category) {
    case "Basic":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-100";
    case "Event Details":
      return "bg-purple-50 text-purple-700 ring-1 ring-purple-100";
    case "Registration":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
    case "Payments":
    default:
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  }
}

export function ProgramFaqsTable() {
  const [faqs] = useState<ProgramFaq[]>(mockFaqs);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FaqCategory | "All">("All");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<ProgramFaq | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<ProgramFaq | null>(null);

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory =
      categoryFilter === "All" ? true : faq.category === categoryFilter;
    const matchesSearch = (() => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.category.toLowerCase().includes(q) ||
        faq.status.toLowerCase().includes(q)
      );
    })();
    return matchesCategory && matchesSearch;
  });

  return (
    <section className="space-y-3 text-xs text-zinc-700 md:text-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">
            Program FAQs
          </h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Manage frequently asked questions for this program.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={() => {
            setEditingFaq(null);
            setShowFormModal(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add FAQs</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-3">
          <div className="w-full md:w-48">
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as FaqCategory | "All")
              }
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="All">All Categories</option>
              <option value="Basic">Basic</option>
              <option value="Event Details">Event Details</option>
              <option value="Registration">Registration</option>
              <option value="Payments">Payments</option>
            </select>
          </div>
        </div>

        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">
            Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by question, answer, category, or status..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs md:text-sm">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">No.</th>
              <th className="w-16 px-3 py-2 text-center">Order</th>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2">Answer</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFaqs.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-[12px] text-zinc-500"
                >
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No FAQs configured yet</span>
                    <span className="text-[11px] text-zinc-400">
                      Use the Add FAQs button to create program FAQs.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFaqs.map((faq, index) => (
                <tr
                  key={faq.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 align-top text-center text-zinc-700">
                    {faq.order}
                  </td>
                  <td className="px-3 py-2 align-top font-medium text-zinc-900">
                    {faq.question}
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] leading-relaxed text-zinc-700 md:text-sm">
                    <span className="line-clamp-2">{faq.answer}</span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex max-w-[160px] items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${getCategoryBadgeClass(
                        faq.category,
                      )}`}
                    >
                      {faq.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        faq.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                          : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                      }`}
                    >
                      {faq.status === "Active" ? (
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                      ) : (
                        <XCircleIcon className="h-3.5 w-3.5" />
                      )}
                      <span>{faq.status}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100"
                        onClick={() => {
                          setSelectedFaq(faq);
                          setShowDetailModal(true);
                        }}
                        aria-label="View details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                        onClick={() => {
                          setEditingFaq(faq);
                          setShowFormModal(true);
                        }}
                        aria-label="Edit FAQ"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                        onClick={() => {
                          // TODO: Nanti dihook-in ke behavior hapus beneran (API / state)
                          // eslint-disable-next-line no-console
                          console.log("Delete FAQ", faq.id);
                        }}
                        aria-label="Delete FAQ"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showFormModal && (
        <ProgramFaqFormModal
          key={editingFaq?.id ?? "new"}
          initialValues={editingFaq ?? undefined}
          mode={editingFaq ? "edit" : "add"}
          onClose={() => {
            setShowFormModal(false);
            setEditingFaq(null);
          }}
        />
      )}

      {showDetailModal && selectedFaq && (
        <ProgramFaqDetailModal
          faq={selectedFaq}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedFaq(null);
          }}
        />
      )}
    </section>
  );
}

type FaqFormMode = "add" | "edit";

interface ProgramFaqFormModalProps {
  onClose: () => void;
  mode?: FaqFormMode;
  initialValues?: ProgramFaq;
}

function ProgramFaqFormModal({
  onClose,
  mode = "add",
  initialValues,
}: ProgramFaqFormModalProps) {
  const [order, setOrder] = useState(initialValues?.order ?? 1);
  const [question, setQuestion] = useState(initialValues?.question ?? "");
  const [answer, setAnswer] = useState(initialValues?.answer ?? "");
  const [category, setCategory] = useState<FaqCategory>(
    initialValues?.category ?? "Basic",
  );
  const [status, setStatus] = useState<FaqStatus>(
    initialValues?.status ?? "Active",
  );

  const isEditMode = mode === "edit";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: ProgramFaq = {
      id: initialValues?.id ?? Date.now(),
      order,
      question,
      answer,
      category,
      status,
    };
    // TODO: Nanti disambungin ke backend / state di parent pas udah mulai implement real data
    // eslint-disable-next-line no-console
    console.log(isEditMode ? "Edit FAQ:" : "Create FAQ:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit FAQ" : "Add FAQ"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the question, answer, category, and status."
                : "Create a new frequently asked question for this program."}
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-3 md:col-span-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Question <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., What is this program about?"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Answer <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Provide a clear and helpful answer for participants."
                  required
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Order <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={order}
                  onChange={(event) => setOrder(Number(event.target.value) || 1)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., 1"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as FaqCategory)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Basic">Basic</option>
                  <option value="Event Details">Event Details</option>
                  <option value="Registration">Registration</option>
                  <option value="Payments">Payments</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as FaqStatus)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
            >
              {isEditMode ? "Save Changes" : "Add FAQ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProgramFaqDetailModalProps {
  faq: ProgramFaq;
  onClose: () => void;
}

function ProgramFaqDetailModal({ faq, onClose }: ProgramFaqDetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              FAQ Details
            </h3>
            <p className="text-[11px] text-zinc-500">
              Overview of the question, answer, category, and status.
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-4 py-3">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Question
            </div>
            <div className="text-sm font-semibold text-zinc-900 md:text-base">
              {faq.question}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Answer
            </div>
            <div className="whitespace-pre-line text-xs text-zinc-700 md:text-sm">
              {faq.answer}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Category
              </div>
              <span
                className={`inline-flex max-w-[160px] items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${getCategoryBadgeClass(
                  faq.category,
                )}`}
              >
                {faq.category}
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Order
              </div>
              <div className="text-sm font-medium text-zinc-900">#{faq.order}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  faq.status === "Active"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                }`}
              >
                {faq.status === "Active" ? (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                ) : (
                  <XCircleIcon className="h-3.5 w-3.5" />
                )}
                <span>{faq.status}</span>
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
