"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "../../components/layout/Sidebar";
import { Navbar } from "../../components/layout/Navbar";
import { InterviewParticipantsHeader } from "../../components/scoring/InterviewParticipantsHeader";
import { InterviewParticipantsTable } from "../../components/scoring/InterviewParticipantsTable";

export default function InterviewScoringPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const selectedProgramId = searchParams.get("program");

  function pushWithProgram(programId: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (programId) {
      params.set("program", programId);
    } else {
      params.delete("program");
    }

    const query = params.toString();
    router.push(query ? `/scoring/interview?${query}` : "/scoring/interview");
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
            <InterviewParticipantsHeader
              onSearch={(value) => {
                // TODO: Nanti integrasi sama logic search yang aseli
                console.info("Search interview participants:", value);
              }}
            />
            <InterviewParticipantsTable
              onExport={() => {
                // TODO: Nanti integrasi sama export data yang aseli
                console.info("Export interview participants data");
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
