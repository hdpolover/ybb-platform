"use client";

import { useParams } from "next/navigation";
import { FullyFundedHeaderCard } from "@/app/components/scoring/FullyFundedHeaderCard";
import { FullyFundedDetailsTabsCard } from "@/app/components/scoring/FullyFundedDetailsTabsCard";

const MOCK_PARTICIPANT_HEADER = {
  fullName: "AFRAH FATIMA MIAH",
  fundingPath: "Fully Funded",
  email: "afrah.fathima2507@gmail.com",
  phone: "66345979",
  nationality: "Bangladesh",
  gender: "female",
  institution: "India International School (Graduated)",
};

export default function FullyFundedParticipantDetailPage() {
  const params = useParams();
  
  const participantId = (params?.participantId as string) || "14047068a37eec1cef0";

  const headerData = MOCK_PARTICIPANT_HEADER;

  return (
    <div className="space-y-6">
      <FullyFundedHeaderCard
        participantId={participantId}
        {...headerData}
        onEditProfile={() => console.info("Edit")}
        onExportData={() => console.info("Export")}
      />
      
      <FullyFundedDetailsTabsCard />
    </div>
  );
}