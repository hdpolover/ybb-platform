import { programs } from "@/app/components/navbar/ProgramSelect";
import { ProgramFaqsTable, type ProgramFaq } from "@/app/components/programFaqsMasterData/ProgramFaqsTable";

// --- UTILITY ---
function getProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  if (!Array.isArray(programs)) return "Selected Program"; // Defensive check
  const program = programs.find((item: any) => item.id === programId);
  return program?.name ?? "Selected Program";
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

export default async function ProgramFaqsPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ search?: string; category?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const programName = getProgramName(resolvedParams.programId);
  const searchQuery = resolvedSearchParams.search?.toLowerCase() || "";
  const categoryQuery = resolvedSearchParams.category || "All";

  // Data filtering dilakukan murni di Server Side
  const filteredData = MOCK_FAQS.filter((faq) => {
    const matchesCategory = categoryQuery === "All" || faq.category === categoryQuery;
    const matchesSearch =
      !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery) ||
      faq.answer.toLowerCase().includes(searchQuery);

    return matchesCategory && matchesSearch;
  });

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="mt-1 text-lg font-bold text-zinc-900">
              {programName} FAQs
            </h1>
            <p className="text-sm text-zinc-500">
              Configure and manage frequently asked questions for this program.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ProgramFaqsTable 
          data={filteredData} 
          currentSearch={searchQuery} 
          currentCategory={categoryQuery} 
        />
      </section>
    </main>
  );
}