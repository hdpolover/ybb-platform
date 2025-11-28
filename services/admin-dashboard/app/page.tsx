"use client";

import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Navbar } from "./components/layout/Navbar";
import { DashboardHeader } from "./components/dashboard/DashboardHeader";
import { ProgramList } from "./components/dashboard/ProgramList";

export default function Home() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(
    null,
  );

  return (
    <div className="flex min-h-screen bg-white text-zinc-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        selectedProgramId={selectedProgramId}
      />

      <div className="flex flex-1 flex-col">
        <Navbar
          onToggleSidebar={() =>
            setSidebarCollapsed((previous) => !previous)
          }
          selectedProgramId={selectedProgramId}
          onChangeProgram={setSelectedProgramId}
        />

        <main className="flex-1 bg-white px-8 py-6">
          <DashboardHeader />
          <ProgramList />
        </main>
      </div>
    </div>
  );
}
