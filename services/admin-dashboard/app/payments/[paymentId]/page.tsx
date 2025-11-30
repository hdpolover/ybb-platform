"use client";

import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "../../components/layout/Sidebar";
import { Navbar } from "../../components/layout/Navbar";
import { PaymentDetailHeader } from "../../components/payments/details/PaymentDetailHeader";
import { ParticipantCard } from "../../components/payments/details/ParticipantCard";
import { PaymentMethodCard } from "../../components/payments/details/PaymentMethodCard";
import { ProgramPaymentCard } from "../../components/payments/details/ProgramPaymentCard";
import { PaymentNotesSection } from "../../components/payments/details/PaymentNotesSection";
import { PaymentBreakdownSection } from "../../components/payments/details/PaymentBreakdownSection";
import { UpdatePaymentStatusModal } from "../../components/payments/details/UpdatePaymentStatusModal";

export default function PaymentDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);

  const selectedProgramId = searchParams.get("program");
  const paymentId = params?.paymentId as string | undefined;

  const handleBack = () => {
    const query = searchParams.toString();
    router.push(query ? `/payments?${query}` : "/payments");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900">
      <Sidebar collapsed={sidebarCollapsed} selectedProgramId={selectedProgramId} />

      <div className="flex h-screen flex-1 flex-col">
        <Navbar
          onToggleSidebar={() => setSidebarCollapsed((previous) => !previous)}
          selectedProgramId={selectedProgramId}
          onChangeProgram={() => {}}
          onResetProgram={() => {}}
        />

        <main className="flex-1 overflow-y-auto bg-white px-8 py-6">
          <div className="space-y-4">
            <PaymentDetailHeader
              transactionId={paymentId ?? "18502"}
              amountLabel="Rp 169.000"
              statusLabel="Cancelled"
              statusVariant="cancelled"
              transactionCode="TR-18502-1764320001"
              orderId="185021764320001958756"
              createdAt="30 Nov 2025"
              onOpenUpdateStatus={() => setShowUpdateStatusModal(true)}
            />

            <section className="grid gap-4 md:grid-cols-3">
              <ParticipantCard
                name="SAMYIA AZIZAHMED MAKRANI"
                email="samyiaazizahmed79@gmail.com"
                participantId="#17061B"
                phone={null}
              />

              <PaymentMethodCard
                title="Debit or Credit Card ( Visa or Mastercard )"
                provider="Midtrans"
                description="Debit or Credit Card (Visa or Mastercard) - after selecting this method on the checkout page, you will be directed to the Midtrans payment page. Follow the instructions on the screen to complete the payment using your card."
              />

              <ProgramPaymentCard
                title="Fully Funded Registration Fee"
                tagLabel="Registration"
                idrPrice="Rp 3.000.000"
                usdPrice="$ 100.00"
                validPeriod="N/A - N/A"
                description="Fully Funded Registration Fee untuk program yang dipilih."
              />
            </section>
            <PaymentNotesSection />
            <PaymentBreakdownSection />
            <UpdatePaymentStatusModal
              open={showUpdateStatusModal}
              onClose={() => setShowUpdateStatusModal(false)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
