"use client";

import Link from "next/link";
import Image from "next/image";
import {
  BuildingOffice2Icon,
  ArrowRightIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { ProgramList } from "./components/dashboard/ProgramList";
import { useRouter } from "next/navigation";
import { useAuth } from "./contexts/AuthContext";
import { useEffect } from "react";

export default function LandingPage() {
  const router = useRouter();
  const { 
    isLoading, 
    adminProfile, 
    adminAccessLevel, 
    accessConfig,
    accessiblePrograms,
    logout,
  } = useAuth();

  const accessibleBrandCount = new Set(accessiblePrograms.map((program) => program.brandId)).size;
  const activeProgramCount = accessiblePrograms.filter((program) => program.isActive).length;
  const welcomeMessage = accessConfig.canAccessPlatform
    ? "Choose what to manage today. Platform access stays separate from program dashboards."
    : `You can manage ${accessiblePrograms.length} program${accessiblePrograms.length !== 1 ? "s" : ""}${accessibleBrandCount > 0 ? ` across ${accessibleBrandCount} brand${accessibleBrandCount !== 1 ? "s" : ""}` : ""}.`;

  const handleSelectProgram = (programId: string | null) => {
    if (programId) {
      router.push(`/programs/${programId}`);
    }
  };

  // Kalau belum ke-auth, arahin dulu ke halaman login
  useEffect(() => {
    if (!isLoading && !adminProfile) {
      router.push("/login");
    }
  }, [isLoading, adminProfile, router]);

  // State pas lagi loading data admin / permission
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-zinc-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Kalau belum ke-auth, fallback-nya ya kosong aja karena udah di-redirect ke login di atas
  if (!adminProfile) {
    return null;
  }

  // State kalau admin ini nggak punya akses ke program atau platform sama sekali
  if (adminAccessLevel === "no_access") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-lg">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-red-100 p-4">
              <UserCircleIcon className="h-12 w-12 text-red-600" />
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-zinc-900">No Access</h1>
          <p className="mb-6 text-zinc-600">
            You don&apos;t have permission to access any dashboard. Please contact a super admin to assign you to programs.
          </p>
          <button
            onClick={() => {
              logout();
            }}
            className="rounded-md bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded">
              <Image
                src="/img/logosYBB.webp"
                alt="YBB Platform logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold text-zinc-900">YBB Platform</span>
              <span className="text-xs text-zinc-500">Administration Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Info Adminnya */}
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <UserCircleIcon className="h-5 w-5 text-zinc-500" />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-zinc-900">{adminProfile.fullName}</span>
                <span className="text-[10px] text-zinc-500">{adminProfile.roleName}</span>
              </div>
            </div>

            {/* Tombol Sign Out*/}
            <button
              onClick={() => logout()}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Content Utama ( Main Content ) */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-8 py-8">
        {/* Section Welcome */}
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mb-2 text-2xl font-bold text-zinc-900">
              Welcome back, {adminProfile.fullName.split(" ")[0]}!
            </h1>
            <p className="text-sm text-zinc-600">{welcomeMessage}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
                {accessiblePrograms.length} program{accessiblePrograms.length !== 1 ? "s" : ""}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
                {activeProgramCount} active
              </span>
              {accessibleBrandCount > 0 ? (
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
                  {accessibleBrandCount} brand{accessibleBrandCount !== 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          </div>

          {accessConfig.canAccessPlatform ? (
            <Link
              href="/platform"
              className="group flex w-full max-w-md items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <BuildingOffice2Icon className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-zinc-900">Platform Administration</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Manage brands, programs, users, admins, and analytics.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-sm font-medium text-blue-600 transition-all group-hover:gap-2">
                <span>Open</span>
                <ArrowRightIcon className="h-4 w-4" />
              </div>
            </Link>
          ) : null}
        </section>

        {/* Pemilihan Program Programnya */}
        <section className="flex flex-1 flex-col min-h-0">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              {accessConfig.canAccessPlatform ? "Program Administration" : "Your Programs"}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {accessConfig.canAccessPlatform 
                ? "Browse program dashboards by brand and switch between grid or list layouts."
                : "Filter your accessible programs by brand and open the dashboard you need."
              }
            </p>
          </div>

          <div className="flex-1 min-h-0">
            <ProgramList onSelectProgram={handleSelectProgram} />
          </div>
        </section>
      </main>
    </div>
  );
}
