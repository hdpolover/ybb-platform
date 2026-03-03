import { ProgramPaymentsTable, type PaymentOptionRow } from "@/app/components/programPaymentsMasterData/options/PaymentOptionTable";

function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

const MOCK_PAYMENT_OPTIONS: PaymentOptionRow[] = [
  {
    id: 1,
    optionName: "Fully Funded Registration Fee",
    category: "Registration Fee",
    fundingType: "Fully Funded",
    amountUsd: 10,
    amountIdrApprox: "Approx. Rp 169.000",
    currentActivePeriodLabel: "Registration Period",
    currentActivePeriodRange: "19 Nov 2025 - 10 Feb 2026",
    currentActiveStatusBadge: "Active Now",
    lastActivePeriodLabel: null,
    lastActivePeriodRange: null,
    lastActiveStatusBadge: null,
    status: "Active",
    description: "Initial registration fee required for all delegates selecting the fully funded route.",
  },
  {
    id: 2,
    optionName: "Self Funded Registration Fee",
    category: "Registration Fee",
    fundingType: "Self Funded",
    amountUsd: 15,
    amountIdrApprox: "Approx. Rp 253.500",
    currentActivePeriodLabel: "Main Period",
    currentActivePeriodRange: "20 Nov 2025 - 11 Apr 2026",
    currentActiveStatusBadge: "Active Now",
    lastActivePeriodLabel: null,
    lastActivePeriodRange: null,
    lastActiveStatusBadge: null,
    status: "Active",
    description: "Registration fee for self-funded delegates.",
  },
];

export default async function ProgramPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const programName = formatProgramName(resolvedParams.programId);
  const searchQuery = resolvedSearchParams.search?.toLowerCase() || "";

  // Filter dipindah ke server (SSR)
  const filteredData = MOCK_PAYMENT_OPTIONS.filter((row) => {
    if (!searchQuery) return true;
    return (
      row.optionName.toLowerCase().includes(searchQuery) || 
      row.category.toLowerCase().includes(searchQuery) || 
      row.fundingType.toLowerCase().includes(searchQuery)
    );
  });

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Program Payments</h1>
            <p className="text-sm text-zinc-500">
              Manage registration and program fee payment options, along with their active periods.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ProgramPaymentsTable data={filteredData} currentSearch={searchQuery} />
      </section>
    </main>
  );
}