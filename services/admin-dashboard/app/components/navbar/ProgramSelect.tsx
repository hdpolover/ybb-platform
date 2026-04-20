"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";

function LogoImg({ src, alt, className = "h-full w-full object-contain" }: { src: string; alt: string; className?: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return <span className="text-[10px] font-bold text-zinc-400">{alt.slice(0, 2).toUpperCase()}</span>;
  }
  return <img src={src} alt={alt} className={className} onError={() => setErrored(true)} />;
}

type ProgramSelectProps = {
  selectedProgramId: string | null;
  onChangeSelectedProgram: (programId: string | null) => void;
  onResetSelectedProgram: () => void;
};

export function ProgramSelect({
  selectedProgramId,
  onChangeSelectedProgram,
  onResetSelectedProgram,
}: ProgramSelectProps) {
  const { accessiblePrograms } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const programOptions = accessiblePrograms.map((program) => ({
    id: program.programId,
    name: program.programName,
    shortName:
      program.programYear > 0 ? `${program.brandSlug.toUpperCase()} ${program.programYear}` : program.brandName,
    logoPath: program.logoUrl || "/img/logosYBB.webp",
    status: program.isActive ? "active" as const : "inactive" as const,
  }));

  const activePrograms = programOptions.filter((program) => program.status === "active");
  const inactivePrograms = programOptions.filter((program) => program.status === "inactive");
  const currentProgram =
    programOptions.find((program) => program.id === selectedProgramId) ?? null;

  return (
    <div
      ref={containerRef}
      className="relative inline-flex min-w-[260px] justify-center"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-md border border-zinc-100 bg-white p-0.5">
            {currentProgram ? (
              <LogoImg src={currentProgram.logoPath} alt={currentProgram.shortName} />
            ) : (
              <span className="text-base font-semibold text-blue-600">?</span>
            )}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold text-zinc-800">
              {currentProgram ? currentProgram.name : "Select Program"}
            </span>
            <span className="text-[12px] font-normal text-zinc-500">
              {currentProgram
                ? currentProgram.shortName
                : "Click to select a program"}
            </span>
          </div>
        </div>
        <span className="text-xs text-zinc-500">▾</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[110%] z-20 w-72 rounded-md border border-zinc-200 bg-white py-2 text-xs shadow-lg origin-top transform transition-all duration-200 ease-out animate-[fadeIn_0.18s_ease-out]">
          <div className="px-3 pb-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Select Program
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              Choose a program to work with
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-2">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Active Programs
            </div>
            <div className="max-h-52 space-y-1 overflow-auto px-1 pb-2">
              {activePrograms.length > 0 ? activePrograms.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => {
                    onChangeSelectedProgram(program.id);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[11px] hover:bg-zinc-50"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 flex-none items-center justify-center overflow-hidden rounded border border-zinc-100 bg-white p-0.5">
                      <LogoImg src={program.logoPath} alt={program.shortName} />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[11px] font-semibold text-zinc-800">
                        {program.name}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {program.shortName.replace(" ", " ")}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-medium text-emerald-600">
                    ACTIVE
                  </span>
                </button>
              )) : (
                <div className="px-2 py-2 text-[11px] text-zinc-500">
                  No active programs available.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-2">
            <button
              type="button"
              onClick={() => setShowInactive((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 hover:text-zinc-700"
            >
              <span>Inactive Programs</span>
              <span className="text-[10px]">{showInactive ? "▴" : "▾"}</span>
            </button>

            {showInactive && (
              <div className="max-h-40 space-y-1 overflow-auto px-1 pb-1">
                {inactivePrograms.map((program) => (
                  <button
                    key={program.id}
                    type="button"
                    onClick={() => {
                      onChangeSelectedProgram(program.id);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[11px] hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 flex-none items-center justify-center overflow-hidden rounded border border-zinc-100 bg-white p-0.5">
                        <LogoImg src={program.logoPath} alt={program.shortName} className="h-full w-full object-contain grayscale" />
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[11px] font-semibold text-zinc-800">
                          {program.name}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {program.shortName.replace(" ", " ")}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] font-medium text-zinc-400">
                      INACTIVE
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="mt-1 flex w-full items-center justify-center gap-2 border-t border-zinc-100 px-3 py-2 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
            onClick={() => {
              onResetSelectedProgram();
              setIsOpen(false);
            }}
          >
            <span>View All Programs</span>
          </button>
        </div>
      )}
    </div>
  );
}
