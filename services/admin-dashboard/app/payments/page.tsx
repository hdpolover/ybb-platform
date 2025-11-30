"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "../components/layout/Sidebar";
import { Navbar } from "../components/layout/Navbar";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { ProgramList } from "../components/dashboard/ProgramList";
import { PaymentsSummary } from "../components/payments/PaymentsSummary";

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const selectedProgramId = searchParams.get("program");

  function pushWithProgram(programId: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (programId) {
      params.set("program", programId);
      const query = params.toString();
      router.push(query ? `/payments?${query}` : "/payments");
    } else {
      params.delete("program");
      const query = params.toString();
      router.push(query ? `/payments?${query}` : "/payments");
    }
  }

  const handleChangeProgram = (programId: string | null) => {
    pushWithProgram(programId);
  };

  const handleResetProgram = () => {
    pushWithProgram(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        selectedProgramId={selectedProgramId}
      />

      <div className="flex h-screen flex-1 flex-col">
        <Navbar
          onToggleSidebar={() =>
            setSidebarCollapsed((previous) => !previous)
          }
          selectedProgramId={selectedProgramId}
          onChangeProgram={handleChangeProgram}
          onResetProgram={handleResetProgram}
        />

        <main className="flex-1 overflow-y-auto bg-white px-8 py-6">
          {selectedProgramId ? (
            <PaymentsSummary selectedProgramId={selectedProgramId} />
          ) : (
            <>
              <DashboardHeader />
              <ProgramList onSelectProgram={handleChangeProgram} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
