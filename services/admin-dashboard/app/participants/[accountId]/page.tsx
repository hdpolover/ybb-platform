"use client";

import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "../../components/layout/Sidebar";
import { Navbar } from "../../components/layout/Navbar";
import { FullyFundedParticipantProfileCard } from "../../components/scoring/FullyFundedParticipantProfileCard";
import { FullyFundedContactInformationCard } from "../../components/scoring/FullyFundedContactInformationCard";
import { FullyFundedDetailsTabsCard } from "../../components/scoring/FullyFundedDetailsTabsCard";

export default function ParticipantDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const selectedProgramId = searchParams.get("program");

  const accountId = (params?.accountId as string) || "167920692d5fa1becc2";
  const source = searchParams.get("source");
  const hideScores = source === "users";

  function pushWithProgram(programId: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (programId) {
      params.set("program", programId);
    } else {
      params.delete("program");
    }

    const query = params.toString();
    const basePath = `/participants/${encodeURIComponent(accountId)}`;
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  const handleChangeProgram = (programId: string | null) => {
    pushWithProgram(programId);
  };

  const handleResetProgram = () => {
    pushWithProgram(null);
  };

  // NOTE: For now we use static dummy data for the participant detail.

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
            <section className="flex flex-col gap-1">
              <h1 className="text-base font-semibold text-zinc-900">Participant Detail</h1>
              <p className="text-xs text-zinc-500">
                Detailed profile and scoring information for the selected participant.
              </p>
              <p className="text-[11px] text-zinc-400">Account ID: {accountId}</p>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <FullyFundedParticipantProfileCard
                name="SAMYIA AZIZAHMED MAKRANI"
                participantId="#17061B"
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
                    // TODO: integrate with edit profile flow
                    console.info("Edit profile clicked");
                  }}
                  onExportData={() => {
                    // TODO: integrate with export data flow
                    console.info("Export data clicked");
                  }}
                />
              </div>
            </section>

            <FullyFundedDetailsTabsCard hideScores={hideScores} />
          </div>
        </main>
      </div>
    </div>
  );
}
