"use client";

import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "../../../components/layout/Sidebar";
import { Navbar } from "../../../components/layout/Navbar";
import { FullyFundedParticipantProfileCard } from "../../../components/scoring/FullyFundedParticipantProfileCard";
import { FullyFundedContactInformationCard } from "../../../components/scoring/FullyFundedContactInformationCard";
import { FullyFundedDetailsTabsCard } from "../../../components/scoring/FullyFundedDetailsTabsCard";

export default function FullyFundedParticipantDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const selectedProgramId = searchParams.get("program");

  const participantId = (params?.participantId as string) || "#17061B";

  function pushWithProgram(programId: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (programId) {
      params.set("program", programId);
    } else {
      params.delete("program");
    }

    const query = params.toString();
    router.push(
      query ? `/scoring/fully-funded/${encodeURIComponent(participantId)}?${query}` : `/scoring/fully-funded/${encodeURIComponent(participantId)}`,
    );
  }

  const handleChangeProgram = (programId: string | null) => {
    pushWithProgram(programId);
  };

  const handleResetProgram = () => {
    pushWithProgram(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900">
      <Sidebar collapsed={sidebarCollapsed} selectedProgramId={selectedProgramId} />

      <div className="flex h-screen flex-1 flex-col">
        <Navbar
          onToggleSidebar={() => setSidebarCollapsed((previous) => !previous)}
          selectedProgramId={selectedProgramId}
          onChangeProgram={handleChangeProgram}
          onResetProgram={handleResetProgram}
        />

        <main className="flex-1 overflow-y-auto bg-white px-8 py-6">
          <div className="space-y-4">
            <section className="grid gap-4 md:grid-cols-3">
              <FullyFundedParticipantProfileCard
                name="SAMYIA AZIZAHMED MAKRANI"
                participantId={participantId}
                fundingPath="Fully Funded"
              />

              <div className="md:col-span-2">
                <FullyFundedContactInformationCard
                  fullName="SAMYIA AZIZAHMED MAKRANI"
                  email="samyiaazizahmed79@gmail.com"
                  phone="+91 98765 43210"
                  nationality="India"
                  gender="Female"
                  institution="ABC International School"
                  onEditProfile={() => {
                    // TODO: Nanti integrasi sama profile aselinya
                    console.info("Edit profile clicked");
                  }}
                  onExportData={() => {
                    // TODO: Nanti integrasi sama export data aselinya
                    console.info("Export data clicked");
                  }}
                />
              </div>
            </section>
            <FullyFundedDetailsTabsCard />
          </div>
        </main>
      </div>
    </div>
  );
}
