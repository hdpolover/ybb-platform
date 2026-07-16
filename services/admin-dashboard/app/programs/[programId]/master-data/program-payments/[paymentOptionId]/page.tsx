import { PeriodPageClient } from "./PeriodPageClient";

function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

export default async function PaymentPeriodsPage({
  params,
}: {
  params: Promise<{ programId: string; paymentOptionId: string }>;
}) {
  const resolvedParams = await params;
  const programName = formatProgramName(resolvedParams.programId);

  return (
    <PeriodPageClient
      programName={programName}
      tierId={resolvedParams.paymentOptionId}
    />
  );
}