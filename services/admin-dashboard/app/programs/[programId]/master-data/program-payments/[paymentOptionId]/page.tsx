import { PaymentPeriodsHeader } from "@/app/components/programPaymentsMasterData/periods/PaymentPeriodsHeader";
import { PaymentPeriodsTable, type PeriodRow } from "@/app/components/programPaymentsMasterData/periods/PaymentPeriodsTable";

function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

const MOCK_PERIODS: PeriodRow[] = [
  { id: 1, name: "Registration Period", base: true, typeLabel: "Base Period", description: "Registration period for Japan Youth Summit 2026", start: "Nov 19, 2025 12:01 AM", end: "Feb 10, 2026 11:59 PM", order: 1, status: "Active" },
  { id: 2, name: "Period I", base: false, typeLabel: "Continuation", description: "Period I", start: "Nov 19, 2025 12:01 AM", end: "Feb 10, 2026 11:59 PM", order: 2, status: "Active", isUpcoming: true, fromParentInfo: "From parent period. Extension starts: Feb 11, 2026" },
  { id: 3, name: "Period II", base: false, typeLabel: "Continuation", description: "Period II", start: "Nov 19, 2025 12:01 AM", end: "Feb 12, 2026 11:59 PM", order: 3, status: "Active", isUpcoming: true, fromParentInfo: "From parent period. Extension starts: Feb 11, 2026" },
];

export default async function PaymentPeriodsPage({
  params,
}: {
  params: Promise<{ programId: string; paymentOptionId: string }>;
}) {
  const resolvedParams = await params;
  const programName = formatProgramName(resolvedParams.programId);

  // Fetching dapat dilakukan di sini menggunakan paymentOptionId

  return (
    <div className="space-y-4">
      <PaymentPeriodsHeader programName={programName} />
      <PaymentPeriodsTable data={MOCK_PERIODS} />
    </div>
  );
}