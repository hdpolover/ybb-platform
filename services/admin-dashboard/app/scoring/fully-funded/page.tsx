"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "../../components/layout/Sidebar";
import { Navbar } from "../../components/layout/Navbar";
import { FullyFundedParticipantsTable } from "../../components/scoring/FullyFundedParticipantsTable";

export default function FullyFundedScoringPage() {
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
    router.push(query ? `/scoring/fully-funded?${query}` : "/scoring/fully-funded");
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
            <section className="flex flex-col gap-1">
              <h1 className="text-base font-semibold text-zinc-900">
                Fully Funded Participants
              </h1>
              <p className="text-xs text-zinc-500">
                Manage all fully funded participants for the selected program.
              </p>
            </section>
            <FullyFundedParticipantsTable />
          </div>
        </main>
      </div>
    </div>
  );
}
