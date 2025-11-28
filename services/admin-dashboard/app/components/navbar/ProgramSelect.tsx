"use client";

import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";

export type Program = {
  id: string;
  name: string;
  shortName: string;
  logoPath: string;
  status: "active" | "inactive";
};

const programs: Program[] = [
  {
    id: "iys-2026",
    name: "Istanbul Youth Summit 2026",
    shortName: "IYS 2026",
    logoPath: "/img/IYSlogo.webp",
    status: "active",
  },
  {
    id: "iys-2025",
    name: "Istanbul Youth Summit 2025",
    shortName: "IYS 2025",
    logoPath: "/img/IYSlogo.webp",
    status: "inactive",
  },
  {
    id: "jys-2026",
    name: "Japan Youth Summit 2026",
    shortName: "JYS 2026",
    logoPath: "/img/jyss.webp",
    status: "active",
  },
  {
    id: "kys-2026",
    name: "Korea Youth Summit 2026",
    shortName: "KYS 2026",
    logoPath: "/img/KYSlogo.webp",
    status: "inactive",
  },
  {
    id: "meys-2026",
    name: "Middle East Youth Summit 2026",
    shortName: "MEYS 2026",
    logoPath: "/img/MEYSlogo.webp",
    status: "inactive",
  },
  {
    id: "wys-2025",
    name: "World Youth Summit 2025",
    shortName: "WYS 2025",
    logoPath: "/img/WYSlogo.webp",
    status: "inactive",
  },
  {
    id: "yaf-2025",
    name: "Youth Academic Forum 2025",
    shortName: "YAF 2025",
    logoPath: "/img/YAFlogo.webp",
    status: "inactive",
  },
];

type ProgramSelectProps = {
  selectedProgramId: string | null;
  onChangeSelectedProgram: (programId: string | null) => void;
};

export function ProgramSelect({
  selectedProgramId,
  onChangeSelectedProgram,
}: ProgramSelectProps) {
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

  const activePrograms = programs.filter((p) => p.status === "active");
  const inactivePrograms = programs.filter((p) => p.status === "inactive");
  const currentProgram =
    programs.find((p) => p.id === selectedProgramId) ?? null;

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
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-white">
            {currentProgram ? (
              <Image
                src={currentProgram.logoPath}
                alt={currentProgram.shortName}
                width={28}
                height={28}
                className="object-contain"
              />
            ) : (
              <span className="text-base font-semibold text-blue-600">?</span>
            )}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold text-zinc-800">
              Select Program
            </span>
            <span className="text-[12px] font-normal text-zinc-500">
              Click to select a program
            </span>
          </div>
        </div>
        <span className="text-xs text-zinc-500">▾</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[110%] z-20 w-72 rounded-md border border-zinc-200 bg-white py-2 text-xs shadow-lg">
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
              {activePrograms.map((program) => (
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
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded bg-white">
                      <Image
                        src={program.logoPath}
                        alt={program.shortName}
                        width={28}
                        height={28}
                        className="object-contain"
                      />
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
              ))}
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
                      <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded bg-white">
                        <Image
                          src={program.logoPath}
                          alt={program.shortName}
                          width={28}
                          height={28}
                          className="object-contain grayscale"
                        />
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
          >
            <span>View All Programs</span>
          </button>
        </div>
      )}
    </div>
  );
}
