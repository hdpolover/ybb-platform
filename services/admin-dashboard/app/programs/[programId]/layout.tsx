"use client";

import { useState, use, useEffect } from "react";
import { Sidebar } from "../../components/layout/Sidebar";
import { Navbar } from "../../components/layout/Navbar";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";

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
  const { adminProfile, assignedPrograms, isLoading, isPlatformAdmin } = useAuth();

  const hasProgramAccess =
    isPlatformAdmin || assignedPrograms.some((program) => program.programId === programId);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!adminProfile) {
      router.replace("/login");
      return;
    }

    if (!hasProgramAccess) {
      router.replace("/");
    }
  }, [adminProfile, hasProgramAccess, isLoading, router]);

  if (isLoading || !adminProfile || !hasProgramAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-zinc-600">Loading...</p>
        </div>
      </div>
    );
  }

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
