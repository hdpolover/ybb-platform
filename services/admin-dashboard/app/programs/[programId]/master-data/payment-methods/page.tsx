import { PaymentMethodsTable, type PaymentMethodRow } from "@/app/components/paymentMethodsMasterData/PaymentMethodsTable";

// --- UTILITY ---
function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

// --- MOCK DATA ---
const MOCK_PAYMENT_METHODS: PaymentMethodRow[] = [
  {
    id: 1,
    name: "Bank Transfer - BCA",
    type: "Bank Transfer",
    imageAlt: "BCA Logo",
    imageSrc: null,
    paymentType: "Manual",
    description: "Pay via manual bank transfer to the provided BCA account number.",
    status: "Active",
  },
  {
    id: 2,
    name: "Bank Transfer - BNI",
    type: "Bank Transfer",
    imageAlt: "BNI Logo",
    imageSrc: null,
    paymentType: "Manual",
    description: "Manual bank transfer option using BNI accounts.",
    status: "Active",
  },
  {
    id: 3,
    name: "Virtual Account - BRI",
    type: "Virtual Account",
    imageAlt: "BRIVA Logo",
    imageSrc: null,
    paymentType: "Gateway",
    description: "Virtual account payment through BRIVA.",
    status: "Active",
  },
  {
    id: 4,
    name: "QRIS / E-Wallet Aggregator",
    type: "E-Wallet",
    imageAlt: "QRIS Logo",
    imageSrc: null,
    paymentType: "Gateway",
    description: "QRIS and e-wallets via integrated payment gateway.",
    status: "Active",
  },
];

export default async function ProgramPaymentMethodsPage({
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

  // Filter logika dipindah ke Server untuk SSR optimal
  const filteredData = MOCK_PAYMENT_METHODS.filter((row) => {
    if (!searchQuery) return true;
    return row.name.toLowerCase().includes(searchQuery) || row.type.toLowerCase().includes(searchQuery);
  });

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            <span>Master Data</span>
          </div>
          <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Payment Methods</h1>
          <p className="text-sm text-zinc-500">
            Manage the payment methods that are available for participants when paying registration or program fees.
          </p>
        </div>
      </div>
    </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <PaymentMethodsTable data={filteredData} currentSearch={searchQuery} />
      </section>
    </main>
  );
}