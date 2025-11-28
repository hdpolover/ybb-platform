"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";

type ProgramStatus = "active" | "inactive";

type ProgramWithMeta = {
  id: string;
  name: string;
  shortName: string;
  logoPath: string;
  status: ProgramStatus;
  dateRange: string;
  websiteUrl?: string;
};

type ProgramGroup = {
  id: string;
  title: string;
  description?: string;
  websiteUrl?: string;
  items: ProgramWithMeta[];
};

const programGroups: ProgramGroup[] = [
  {
    id: "istanbul",
    title: "Istanbul Youth Summit",
    websiteUrl: "https://www.istanbulyouthsummit.com/",
    items: [
      {
        id: "iys-2024",
        name: "IYS 2024",
        shortName: "IYS 2024",
        logoPath: "/img/IYSlogo.webp",
        status: "inactive",
        dateRange: "Feb 21, 2024 - Feb 29, 2024",
      },
      {
        id: "iys-2025",
        name: "Istanbul Youth Summit 2025",
        shortName: "IYS 2025",
        logoPath: "/img/IYSlogo.webp",
        status: "inactive",
        dateRange: "Feb 16, 2025 - Feb 24, 2025",
      },
      {
        id: "iys-2026",
        name: "Istanbul Youth Summit 2026",
        shortName: "IYS 2026",
        logoPath: "/img/IYSlogo.webp",
        status: "active",
        dateRange: "Feb 10, 2026 - Feb 18, 2026",
      },
    ],
  },
  {
    id: "japan",
    title: "Japan Youth Summit",
    websiteUrl: "https://japanyouthsummit.com/",
    items: [
      {
        id: "jys-2025",
        name: "Japan Youth Summit 2025",
        shortName: "JYS 2025",
        logoPath: "/img/jyss.webp",
        status: "inactive",
        dateRange: "Oct 12, 2025 - Oct 15, 2025",
      },
      {
        id: "jys-2026",
        name: "Japan Youth Summit 2026",
        shortName: "JYS 2026",
        logoPath: "/img/jyss.webp",
        status: "active",
        dateRange: "May 11, 2026 - May 19, 2026",
      },
    ],
  },
  {
    id: "korea",
    title: "Korea Youth Summit",
    websiteUrl: "https://www.koreayouthsummit.com/",
    items: [
      {
        id: "kys-2025",
        name: "Korea Youth Summit 2025",
        shortName: "KYS 2025",
        logoPath: "/img/KYSlogo.webp",
        status: "inactive",
        dateRange: "Aug 03, 2025 - Aug 09, 2025",
      },
      {
        id: "kys-2026",
        name: "Korea Youth Summit 2026",
        shortName: "KYS 2026",
        logoPath: "/img/KYSlogo.webp",
        status: "active",
        dateRange: "Aug 05, 2026 - Aug 12, 2026",
      },
    ],
  },
  {
    id: "meys",
    title: "Middle East Youth Summit",
    websiteUrl: "https://middleeastyouthsummit.com/",
    items: [
      {
        id: "meys-2025",
        name: "Middle East Youth Summit 2025",
        shortName: "MEYS 2025",
        logoPath: "/img/MEYSlogo.webp",
        status: "inactive",
        dateRange: "Jan 10, 2025 - Jan 18, 2025",
      },
      {
        id: "meys-2026",
        name: "Middle East Youth Summit 2026",
        shortName: "MEYS 2026",
        logoPath: "/img/MEYSlogo.webp",
        status: "active",
        dateRange: "Jan 12, 2026 - Jan 20, 2026",
      },
    ],
  },
  {
    id: "wyf",
    title: "World Youth Fest",
    websiteUrl: "https://worldyouthfest.com/",
    items: [
      {
        id: "wyf-2024",
        name: "World Youth Fest 2024",
        shortName: "WYF 2024",
        logoPath: "/img/WYSlogo.webp",
        status: "inactive",
        dateRange: "Oct 25, 2024 - Oct 31, 2024",
      },
      {
        id: "wyf-2025",
        name: "World Youth Fest 2025",
        shortName: "WYF 2025",
        logoPath: "/img/WYSlogo.webp",
        status: "active",
        dateRange: "Oct 25, 2025 - Oct 31, 2025",
      },
    ],
  },
  {
    id: "yaf",
    title: "Youth Academic Forum",
    websiteUrl: "http://youthacademicforum.com/",
    items: [
      {
        id: "yaf-2025",
        name: "Youth Academic Forum 2025",
        shortName: "YAF 2025",
        logoPath: "/img/YAFlogo.webp",
        status: "active",
        dateRange: "Nov 10, 2025 - Nov 14, 2025",
      },
    ],
  },
];

function StatusBadge({ status }: { status: ProgramStatus }) {
  const isActive = status === "active";

  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-[2px] text-[11px] font-semibold uppercase tracking-wide ${
        isActive
          ? "bg-emerald-100 text-emerald-700"
          : "bg-rose-100 text-rose-700"
      }`}
    >
      {isActive ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

function ProgramCard({ program }: { program: ProgramWithMeta }) {
  return (
    <button
      type="button"
      className="flex w-full items-stretch gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
      onClick={() => {
        // TODO: ganti dengan navigasi ke halaman detail program
        // misalnya: router.push(`/programs/${program.id}`)
        console.info("Program clicked:", program.id);
      }}
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded bg-white">
        <Image
          src={program.logoPath}
          alt={program.shortName}
          width={56}
          height={56}
          className="object-contain"
        />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1 overflow-hidden text-sm">
        <div className="truncate font-semibold text-zinc-900">
          {program.name}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
          <span>{program.dateRange}</span>
          <StatusBadge status={program.status} />
        </div>
      </div>
    </button>
  );
}

function ProgramGroupRow({
  group,
  isOpen,
  onToggle,
}: {
  group: ProgramGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const activePrograms = group.items.filter((item) => item.status === "active");
  const inactivePrograms = group.items.filter(
    (item) => item.status === "inactive",
  );

  const primaryProgram =
    activePrograms[0] ?? group.items[0] ?? null;

  if (!primaryProgram) return null;

  return (
    <section className="relative flex h-full flex-col rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-zinc-900">
            {group.title}
          </h2>
          {group.websiteUrl && (
            <a
              href={group.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium text-zinc-600 shadow-sm hover:border-blue-300 hover:text-blue-700 hover:shadow-md"
            >
              <span>Visit website</span>
            </a>
          )}
        </div>
        {group.description && (
          <p className="text-[12px] text-zinc-500">{group.description}</p>
        )}
      </div>

      <ProgramCard program={primaryProgram} />

      <div
        className="mt-2 flex items-center justify-between text-[11px] text-zinc-500"
        data-inactive-dropdown
      >
        <span>Active edition shown above.</span>
        {inactivePrograms.length > 0 && (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-800"
          >
            <span>Inactive Programs ({inactivePrograms.length})</span>
            <span className="text-[10px]">{isOpen ? "▴" : "▾"}</span>
          </button>
        )}
      </div>

      {isOpen && inactivePrograms.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-2 rounded-md border border-zinc-200 bg-white px-3 py-3 shadow-lg"
          data-inactive-dropdown
        >
          <div className="max-h-64 space-y-2 overflow-auto">
            {inactivePrograms.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function ProgramList() {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!openGroupId) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const insideDropdown = target.closest("[data-inactive-dropdown]");
      if (!insideDropdown) {
        setOpenGroupId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openGroupId]);

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {programGroups.map((group) => (
        <ProgramGroupRow
          key={group.id}
          group={group}
          isOpen={openGroupId === group.id}
          onToggle={() =>
            setOpenGroupId((previous) =>
              previous === group.id ? null : group.id,
            )
          }
        />
      ))}
    </div>
  );
}
