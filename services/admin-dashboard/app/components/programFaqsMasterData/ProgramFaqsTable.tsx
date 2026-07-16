import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import {
  FaqFilters,
  AddFaqAction,
  ViewFaqAction,
  EditFaqAction,
  DeleteFaqAction,
} from "./FaqActions";

// TYPES
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

// UTILS
function getCategoryBadgeClass(category: FaqCategory): string {
  switch (category) {
    case "Basic": return "bg-blue-50 text-blue-700";
    case "Event Details": return "bg-purple-50 text-purple-700";
    case "Registration": return "bg-emerald-50 text-emerald-700";
    case "Payments": default: return "bg-amber-50 text-amber-700";
  }
}

// MAIN SERVER COMPONENT
export function ProgramFaqsTable({
  data,
  currentSearch,
  currentCategory,
}: {
  data: ProgramFaq[];
  currentSearch: string;
  currentCategory: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-zinc-200 pb-5">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-900">Program FAQs</h2>
          <p className="text-sm text-zinc-500">Manage frequently asked questions for this program.</p>
        </div>
        <AddFaqAction />
      </div>

      <FaqFilters initialSearch={currentSearch} initialCategory={currentCategory} />

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">No</th>
              <th className="w-20 px-6 py-4 text-center font-semibold">Order</th>
              <th className="px-6 py-4 font-semibold">Question & Answer</th>
              <th className="w-40 px-6 py-4 font-semibold">Category</th>
              <th className="w-32 px-6 py-4 font-semibold">Status</th>
              <th className="w-36 px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-2">
                    <span className="font-semibold text-zinc-900">No FAQs found</span>
                    <span className="text-xs text-zinc-500">
                      Adjust your filters or click Add FAQ to create a new one.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((faq, index) => (
                <tr key={faq.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-5 align-top text-xs font-medium text-zinc-500">
                    {index + 1}
                  </td>
                  <td className="px-6 py-5 align-top text-center text-sm font-semibold text-zinc-700">
                    {faq.order}
                  </td>
                  <td className="px-6 py-5 align-top">
                    <div className="space-y-1.5">
                      <div className="font-bold text-zinc-900">{faq.question}</div>
                      <div className="max-w-xl text-xs leading-relaxed text-zinc-600 line-clamp-2">
                        {faq.answer}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <span className={`inline-flex items-center justify-center rounded px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${getCategoryBadgeClass(faq.category)}`}>
                      {faq.category}
                    </span>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${faq.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                      {faq.status === "Active" ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                      <span>{faq.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-5 align-top text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <ViewFaqAction faq={faq} />
                      <EditFaqAction faq={faq} />
                      <DeleteFaqAction id={faq.id} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}