"use client";

import Link from "next/link";
import Image from "next/image";
import {
  BuildingOffice2Icon,
  RectangleStackIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { ProgramList } from "./components/dashboard/ProgramList";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  const handleSelectProgram = (programId: string | null) => {
    if (programId) {
      router.push(`/programs/${programId}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 via-white to-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Help
            </button>
            <button
              type="button"
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Profile
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="mb-2 text-3xl font-bold text-zinc-900">
            Welcome to YBB Platform
          </h1>
          <p className="text-lg text-zinc-600">
            Choose your administration mode to get started
          </p>
        </div>

        {/* Admin Mode Cards */}
        <div className="mb-16 grid gap-6 md:grid-cols-2">
          {/* Platform Admin Card */}
          <Link
            href="/platform"
            className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-8 shadow-sm transition-all hover:border-blue-300 hover:shadow-lg"
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
              <BuildingOffice2Icon className="h-8 w-8" />
            </div>
            
            <h2 className="mb-3 text-xl font-semibold text-zinc-900">
              Platform Administration
            </h2>
            <p className="mb-4 text-sm text-zinc-600">
              Manage program categories, create and configure programs, oversee users and admins, and access platform-wide analytics
            </p>

            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:gap-3 transition-all">
              <span>Go to Platform Admin</span>
              <ArrowRightIcon className="h-4 w-4" />
            </div>

            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-50 opacity-50 transition-all group-hover:scale-150 group-hover:bg-blue-100" />
          </Link>

          {/* Program Admin Card */}
          <div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <RectangleStackIcon className="h-8 w-8" />
            </div>
            
            <h2 className="mb-3 text-xl font-semibold text-zinc-900">
              Program Administration
            </h2>
            <p className="mb-4 text-sm text-zinc-600">
              Manage specific program operations including applications, payments, participants, and program-level analytics
            </p>

            <div className="text-sm font-medium text-zinc-500">
              Select a program below to continue
            </div>

            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-green-50 opacity-50" />
          </div>
        </div>

        {/* Program Selection */}
        <div>
          <div className="mb-6">
            <h2 className="mb-2 text-xl font-semibold text-zinc-900">
              Select a Program
            </h2>
            <p className="text-sm text-zinc-600">
              Choose a program to access program-specific administration features
            </p>
          </div>

          <ProgramList onSelectProgram={handleSelectProgram} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white/50 py-6">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-zinc-500">
          © 2025 YBB Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
