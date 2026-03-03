import { PaymentsSummary } from "@/app/components/payments/PaymentsSummary"; 

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  // const data = await getData(programId);

  return (
    <main>
      <PaymentsSummary selectedProgramId={programId} />
    </main>
  );
}