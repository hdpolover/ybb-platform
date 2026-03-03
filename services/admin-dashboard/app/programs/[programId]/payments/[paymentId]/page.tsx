"use client";

import { useSearchParams, useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { PaymentDetailHeader } from "@/app/components/payments/details/PaymentDetailHeader";
import { PaymentInfoSection } from "@/app/components/payments/details/PaymentInfoSection";
import { PaymentChartSection } from "@/app/components/payments/details/PaymentChartSection";
import { PaymentHistorySection, HistoryItem } from "@/app/components/payments/details/PaymentHistorySection";
import { ParticipantStatusSection, ParticipantStatusItem } from "@/app/components/payments/details/ParticipantStatusSection";

const MOCK_DATA = {
  transactionId: "20099",
  status: "Success",
  participantName: "YAWSON SAMUEL",
  email: "ahagpi2002@gmail.com",
  phone: "+6182392830282",
  orderId: "225671768483559976901",
  transactionCode: "TR-20099-1766421681",
  dateCreated: "Jan 15, 2026 20:25",
  paymentVia: "Credit/Debit Card",
  registrationType: "Self-Funded",
  paymentDesc: "Registration Fee (Self-Funded)",
  programEarnings: 165958,
  adminFee: 3042,
  totalPayment: 169000,
};

const MOCK_HISTORY: HistoryItem[] = [
  { id: 1, statusLabel: "Completed", title: "Payment Status Updated", description: "Payment status updated to success.", date: "Completed on: 21 January 2026" },
  { id: 2, statusLabel: "Completed", title: "Payment Created", description: "Payment record was created in the system.", date: "Completed on: 18 January 2026" },
];

const MOCK_PARTICIPANT_STATUS: ParticipantStatusItem[] = [
  {
    step: 1,
    state: "Completed",
    title: "Participant Registration Fully Funded",
    description: "Your registration has been successfully submitted and verified by the YBB team.",
    date: "Completed on: 21 January 2026",
  },
  {
    step: 2,
    state: "In Progress",
    title: "LoA Announcement",
    description: "Your application has passed the registration review stage. The Letter of Acceptance (LoA) is currently being prepared by the YBB team.",
    processing: "Processing period: 22-24 January 2026",
    release: "Estimated release: 24 January 2026",
  },
  {
    step: 3,
    state: "Not Yet",
    title: "First Installment Payment",
    description: "This payment step will be available after the LoA is officially issued. Completing the first installment is required to continue to the next stage.",
    date: "Payment window: 25-28 January 2026",
  },
  {
    step: 4,
    state: "Not Yet",
    title: "Second Installment Payment",
    description: "The second installment payment is required after the mentoring session to proceed with final preparation.",
    opening: "Estimated opening: Early February 2026",
  },
  {
    step: 5,
    state: "Not Yet",
    title: "Interview Announcement for Fully Funded Candidates",
    description: "Eligible participants will be shortlisted and invited for the fully funded interview stage.",
    announcement: "Estimated announcement: 26-28 January 2026",
  },
  {
    step: 6,
    state: "Not Yet",
    title: "Final Announcement for Fully Funded Participants",
    description: "This payment step will be available after the LoA is officially issued. Completing the first installment is required to continue to the next stage.",
    date: "Payment window: 25-28 January 2026",
  },
  {
    step: 7,
    state: "Not Yet",
    title: "Korea Youth Summit Program",
    description: "You are scheduled to participate in the Korea Youth Summit program.",
    programDates: "Program dates: 02-05 February 2026",
    location: "Location: Seoul, South Korea",
  },
];

export default function PaymentDetailPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  
  const [activeTab, setActiveTab] = useState("Payment");
  const programId = params?.programId as string;

  const query = searchParams.toString();
  const backUrl = query ? `/programs/${programId}/payments?${query}` : `/programs/${programId}/payments`;

  return (
    <div className="mx-auto w-full  space-y-6">
      
      <div className="text-sm px-1">
        <Link href={backUrl} className="text-zinc-500 hover:text-blue-600 font-medium transition-colors">
          Dashboard
        </Link>
        <span className="text-zinc-400 mx-2">&gt;</span>
        <span className="font-semibold text-blue-600">Detail Payment</span>
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-6 md:p-8 shadow-sm">
        
        <PaymentDetailHeader data={MOCK_DATA} programId={programId} />

        {/* TABS NAVIGATION */}
        <div className="mt-8 border-b border-zinc-200">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            {["Payment", "History", "Status"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* TABS CONTENT */}
        <div className="mt-8">
          {activeTab === "Payment" && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-stretch">
              <div className="lg:col-span-2">
                 <PaymentInfoSection data={MOCK_DATA} />
              </div>
              <div className="lg:col-span-1 h-full">
                 <PaymentChartSection data={MOCK_DATA} />
              </div>
            </div>
          )}

          {activeTab === "History" && (
            <PaymentHistorySection histories={MOCK_HISTORY} />
          )}
          
          {activeTab === "Status" && (
            <ParticipantStatusSection statuses={MOCK_PARTICIPANT_STATUS} />
          )}
        </div>
      </div>
    </div>
  );
}