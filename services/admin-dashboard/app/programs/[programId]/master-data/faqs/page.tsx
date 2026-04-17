"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { ProgramFaqsTable, type ProgramFaq } from "@/app/components/programFaqsMasterData/ProgramFaqsTable";
import { listProgramFaqs } from "@/src/shared/api-client";

export default function ProgramFaqsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const [faqs, setFaqs] = useState<ProgramFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const programName =
    accessiblePrograms.find((p) => p.programId === params.programId)?.programName ?? "Selected Program";

  useEffect(() => {
    if (!params.programId) return;
    setLoading(true);
    listProgramFaqs(params.programId)
      .then((data) => {
        setFaqs(
          data.map((faq, idx) => ({
            id: idx + 1,
            order: faq.order,
            question: faq.question,
            answer: faq.answer,
            category: (faq.category as ProgramFaq["category"]) ?? "Basic",
            status: faq.isActive ? "Active" : "Inactive",
          })),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load FAQs"))
      .finally(() => setLoading(false));
  }, [params.programId]);

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Master Data
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} FAQs</h1>
        <p className="text-sm text-zinc-500">Configure and manage frequently asked questions for this program.</p>
      </section>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {loading && <p className="text-xs text-zinc-400">Loading FAQs&hellip;</p>}

      {!loading && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <ProgramFaqsTable data={faqs} currentSearch="" currentCategory="All" />
        </section>
      )}
    </main>
  );
}


// --- LOCAL MOCK DATA ---
const MOCK_FAQS: ProgramFaq[] = [
  {
    id: 1,
    order: 1,
    question: "What is this program about?",
    answer: "This program is designed to connect young leaders around the world through experiential learning, cultural exchange, and social impact projects.",
    category: "Basic",
    status: "Active",
  },
  {
    id: 2,
    order: 2,
    question: "Where will the event take place?",
    answer: "The event will be held in a hybrid format with main activities in Jakarta, Indonesia, and selected sessions online.",
    category: "Event Details",
    status: "Active",
  },
  {
    id: 3,
    order: 3,
    question: "How do I complete my registration?",
    answer: "After being accepted, you will receive an email with a registration link. Complete the form and upload all required documents before the deadline.",
    category: "Registration",
    status: "Active",
  },
  {
    id: 4,
    order: 4,
    question: "What payment methods are available?",
    answer: "You can pay using bank transfer, virtual account, or international credit/debit card depending on your country.",
    category: "Payments",
    status: "Inactive",
  },
];
