"use client";

import Link from "next/link";
import Image from "next/image";
import {
  BuildingOffice2Icon,
  RectangleStackIcon,
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
    isPlatformAdmin, 
    assignedPrograms,
    logout,
  } = useAuth();

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
        <section>
          <h1 className="mb-2 text-2xl font-bold text-zinc-900">
            Welcome back, {adminProfile.fullName.split(' ')[0]}!
          </h1>
          <p className="text-sm text-zinc-600">
            {accessConfig.canAccessPlatform 
              ? "Choose your administration mode to get started"
              : `You have access to ${assignedPrograms.length} program${assignedPrograms.length !== 1 ? 's' : ''}`
            }
          </p>
        </section>

        {/* mode Admin Card ( Khusus buat Admin ) */}
        {accessConfig.canAccessPlatform && (
          <section className="grid gap-4 md:grid-cols-2">
            {/* Admin Cardnya ( Platformnya ) */}
            <Link
              href="/platform"
              className="group rounded-lg border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  <BuildingOffice2Icon className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <h2 className="mb-1 text-base font-semibold text-zinc-900">
                    Platform Administration
                  </h2>
                  <p className="mb-3 text-sm text-zinc-600">
                    Manage categories, programs, users, admins, and platform-wide analytics
                  </p>
                  <div className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-all group-hover:gap-2">
                    <span>Go to Platform Admin</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Program Card Admin */}
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <RectangleStackIcon className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <h2 className="mb-1 text-base font-semibold text-zinc-900">
                    Program Administration
                  </h2>
                  <p className="text-sm text-zinc-600">
                    {accessConfig.canAccessPrograms
                      ? "Manage specific program operations, applications, payments, and participants"
                      : "No program assignments are available for this admin yet."}
                  </p>
                  {accessConfig.canAccessPrograms ? (
                    <p className="mt-3 text-xs font-medium text-zinc-500">
                      Select a program below to continue.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Pemilihan Program Programnya */}
        <section className="flex flex-1 flex-col min-h-0">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              {accessConfig.canAccessPlatform ? "Select a Program" : "Your Programs"}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {accessConfig.canAccessPlatform 
                ? "Choose a program to access program-specific administration"
                : "Click on a program to access its dashboard"
              }
            </p>
          </div>

          <div className="flex-1 min-h-0">
            <div className="h-full overflow-y-auto pr-1">
              {/* Nunjukin program yang ke filter buat admin */}
              {accessConfig.canAccessPlatform ? (
                <ProgramList onSelectProgram={handleSelectProgram} />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {assignedPrograms.map((program) => (
                    <button
                      key={program.programId}
                      onClick={() => handleSelectProgram(program.programId)}
                      className="group rounded-lg border border-zinc-200 bg-white p-5 text-left shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                          <RectangleStackIcon className="h-6 w-6" />
                        </div>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                          {program.programYear}
                        </span>
                      </div>
                      
                      <h3 className="mb-1 font-semibold text-zinc-900">{program.programName}</h3>
                      <p className="mb-3 text-xs text-zinc-500">
                        Role: <span className="font-medium capitalize text-zinc-700">{program.roleInProgram}</span>
                      </p>

                      <div className="flex items-center gap-1 text-sm font-medium text-emerald-600 transition-all group-hover:gap-2">
                        <span>Open Dashboard</span>
                        <ArrowRightIcon className="h-4 w-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
