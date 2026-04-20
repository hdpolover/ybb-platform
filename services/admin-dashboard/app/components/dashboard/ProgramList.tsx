"use client";

import React, { useMemo, useState } from "react";
import { RectangleStackIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";

type ProgramListProps = {
  onSelectProgram: (programId: string) => void;
};

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatRange(start, end);
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-[2px] text-[11px] font-semibold uppercase tracking-wide ${
        isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
      }`}
    >
      {isActive ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

function ProgramLogo({ logoUrl, name }: { logoUrl?: string | null; name: string }) {
  const [errored, setErrored] = useState(false);
  if (logoUrl && !errored) {
    return (
      <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl bg-zinc-100">
        <img
          src={logoUrl}
          alt={name}
          className="h-full w-full object-contain"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-blue-50 text-blue-600">
      <RectangleStackIcon className="h-7 w-7" />
    </div>
  );
}

function ProgramCard({
  program,
  onSelectProgram,
}: {
  program: ReturnType<typeof useAuth>["accessiblePrograms"][number];
  onSelectProgram: (programId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectProgram(program.programId)}
      className="flex w-full items-stretch gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
    >
      <ProgramLogo logoUrl={program.logoUrl} name={program.programName} />
      <div className="flex flex-1 flex-col justify-center gap-1 overflow-hidden text-sm">
        <div className="truncate font-semibold text-zinc-900">{program.programName}</div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
          <span>{formatDateRange(program.startDate, program.endDate)}</span>
          <StatusBadge isActive={program.isActive} />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span>{program.programSlug}</span>
          <span>•</span>
          <span>{program.programYear}</span>
        </div>
      </div>
    </button>
  );
}

function ProgramSection({
  title,
  description,
  programs,
  onSelectProgram,
}: {
  title: string;
  description: string;
  programs: ReturnType<typeof useAuth>["accessiblePrograms"];
  onSelectProgram: (programId: string) => void;
}) {
  if (programs.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1 text-xs text-zinc-500">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {programs.map((program) => (
          <ProgramCard key={program.programId} program={program} onSelectProgram={onSelectProgram} />
        ))}
      </div>
    </section>
  );
}

export function ProgramList({ onSelectProgram }: ProgramListProps) {
  const { accessiblePrograms, isLoading } = useAuth();

  const [activePrograms, inactivePrograms] = useMemo(() => {
    const active = accessiblePrograms.filter((program) => program.isActive);
    const inactive = accessiblePrograms.filter((program) => !program.isActive);
    return [active, inactive];
  }, [accessiblePrograms]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
        Loading programs...
      </div>
    );
  }

  if (accessiblePrograms.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
        No programs are available yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProgramSection
        title="Active Programs"
        description="Current programs available for administration."
        programs={activePrograms}
        onSelectProgram={onSelectProgram}
      />
      <ProgramSection
        title="Inactive Programs"
        description="Past or archived programs that remain available for reference."
        programs={inactivePrograms}
        onSelectProgram={onSelectProgram}
      />
    </div>
  );
}
