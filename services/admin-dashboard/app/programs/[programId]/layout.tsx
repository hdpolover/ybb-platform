"use client";

import { useState, use } from "react";
import { Sidebar } from "../../components/layout/Sidebar";
import { Navbar } from "../../components/layout/Navbar";
import { useRouter } from "next/navigation";

export default function ProgramLayout({
  params,
  children,
}: {
  params: Promise<{ programId: string }>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { programId } = use(params);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleChangeProgram = (newProgramId: string | null) => {
    if (newProgramId) {
      router.push(`/programs/${newProgramId}`);
    } else {
      router.push("/");
    }
  };

  const handleResetProgram = () => {
    router.push("/");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        selectedProgramId={programId}
      />

      <div className="flex h-screen flex-1 flex-col">
        <Navbar
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          selectedProgramId={programId}
          onChangeProgram={handleChangeProgram}
          onResetProgram={handleResetProgram}
        />

        <main className="flex-1 overflow-y-auto bg-white px-8 py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
