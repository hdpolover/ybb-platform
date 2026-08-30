"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bars3Icon,
  ChevronRightIcon,
  RectangleStackIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";
import { parseApiDate } from "@/lib/utils";
import { getPricingTierAlertsSummary, type PricingTierAlertsSummaryItem } from "@/app/platform/api";

type ProgramListProps = {
  onSelectProgram: (programId: string) => void;
};

type ProgramViewMode = "grid" | "list";

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseApiDate(startDate);
  const end = parseApiDate(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "—";
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

// Surfaces the "silent lapse" defect (China Youth Summit's fully-funded category
// went silently unpurchasable for 9 days) on the program list itself, not just
// the per-program payments page banner. Lapsed (rose) means an active outage
// right now; expiring-only (amber) is the leading indicator. Not a <button> and
// carries no hover/cursor styling of its own — the card it sits on is already
// the click target.
function CoverageGapBadge({ summary }: { summary: PricingTierAlertsSummaryItem }) {
  const isLapsed = summary.lapsedCount > 0;
  const count = isLapsed ? summary.lapsedCount : summary.expiringCount;
  const label = isLapsed
    ? `${count} categor${count === 1 ? "y" : "ies"} not purchasable`
    : `${count} categor${count === 1 ? "y" : "ies"} losing coverage soon`;

  return (
    <span
      title={
        isLapsed
          ? "No validity period currently covers this category. Participants cannot see or pay for it."
          : "This category's coverage ends before registration closes."
      }
      className={`inline-flex items-center rounded-sm px-2 py-[2px] text-[11px] font-semibold ${
        isLapsed ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {label}
    </span>
  );
}

function ProgramLogo({ logoUrl, name }: { logoUrl?: string | null; name: string }) {
  const [errored, setErrored] = useState(false);
  if (logoUrl && !errored) {
    return (
      <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl bg-zinc-100">
        {/* Logos can come from dynamic storage domains that are not allowlisted in Next image config yet. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
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
  viewMode,
  alertSummary,
}: {
  program: ReturnType<typeof useAuth>["accessiblePrograms"][number];
  onSelectProgram: (programId: string) => void;
  viewMode: ProgramViewMode;
  alertSummary?: PricingTierAlertsSummaryItem;
}) {
  if (viewMode === "list") {
    return (
      <button
        type="button"
        onClick={() => onSelectProgram(program.programId)}
        className="flex w-full items-center gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
      >
        <ProgramLogo logoUrl={program.logoUrl} name={program.programName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate font-semibold text-zinc-900">{program.programName}</h4>
            <StatusBadge isActive={program.isActive} />
            {alertSummary ? <CoverageGapBadge summary={alertSummary} /> : null}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {program.brandName} • {program.programSlug}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {formatDateRange(program.startDate, program.endDate)}
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {program.programYear}
          </p>
          <p className="mt-1 text-xs capitalize text-zinc-500">{program.roleInProgram}</p>
        </div>
      </button>
    );
  }

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
          <span>{program.brandName}</span>
          <span>•</span>
          <span>{program.programSlug}</span>
          <span>•</span>
          <span>{program.programYear}</span>
        </div>
        {alertSummary ? (
          <div className="mt-1">
            <CoverageGapBadge summary={alertSummary} />
          </div>
        ) : null}
      </div>
    </button>
  );
}

function ProgramSection({
  title,
  description,
  programs,
  onSelectProgram,
  viewMode,
  alertsByProgramId,
}: {
  title: string;
  description: string;
  programs: ReturnType<typeof useAuth>["accessiblePrograms"];
  onSelectProgram: (programId: string) => void;
  viewMode: ProgramViewMode;
  alertsByProgramId: Map<string, PricingTierAlertsSummaryItem>;
}) {
  if (programs.length === 0) {
    return null;
  }

  const hasHeader = Boolean(title || description);

  return (
    <section className="space-y-3">
      {hasHeader ? (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        </div>
      ) : null}
      <div className={viewMode === "grid" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
        {programs.map((program) => (
          <ProgramCard
            key={program.programId}
            program={program}
            onSelectProgram={onSelectProgram}
            viewMode={viewMode}
            alertSummary={alertsByProgramId.get(program.programId)}
          />
        ))}
      </div>
    </section>
  );
}

export function ProgramList({ onSelectProgram }: ProgramListProps) {
  const { accessiblePrograms, isLoading } = useAuth();
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [viewMode, setViewMode] = useState<ProgramViewMode>("grid");
  const [showInactivePrograms, setShowInactivePrograms] = useState(false);
  const [alertsByProgramId, setAlertsByProgramId] = useState<Map<string, PricingTierAlertsSummaryItem>>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    // getPricingTierAlertsSummary already fails soft to [] on error, so a
    // broken endpoint just leaves the map empty (no badges) instead of
    // breaking the dashboard home.
    getPricingTierAlertsSummary().then((items) => {
      if (cancelled) return;
      setAlertsByProgramId(new Map(items.map((item) => [item.programId, item])));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const brands = useMemo(() => {
    const brandMap = new Map<string, { id: string; name: string }>();

    accessiblePrograms.forEach((program) => {
      if (!brandMap.has(program.brandId)) {
        brandMap.set(program.brandId, { id: program.brandId, name: program.brandName });
      }
    });

    return Array.from(brandMap.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [accessiblePrograms]);

  const filteredPrograms = useMemo(() => {
    if (!selectedBrandId) {
      return accessiblePrograms;
    }

    return accessiblePrograms.filter((program) => program.brandId === selectedBrandId);
  }, [accessiblePrograms, selectedBrandId]);

  const [activePrograms, inactivePrograms] = useMemo(() => {
    const active = filteredPrograms.filter((program) => program.isActive);
    const inactive = filteredPrograms.filter((program) => !program.isActive);
    return [active, inactive];
  }, [filteredPrograms]);

  const selectedBrandName = brands.find((brand) => brand.id === selectedBrandId)?.name;

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
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {selectedBrandName
                ? `Showing ${filteredPrograms.length} programs in ${selectedBrandName}`
                : `Showing ${filteredPrograms.length} programs across ${brands.length || 1} brand${brands.length === 1 ? "" : "s"}`}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Filter by brand or switch between grid and list views.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {brands.length > 1 ? (
              <select
                value={selectedBrandId}
                onChange={(event) => setSelectedBrandId(event.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Brands</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            ) : null}

            <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-pressed={viewMode === "grid"}
                className={`inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === "grid"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Squares2X2Icon className="h-4 w-4" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={`inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === "list"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Bars3Icon className="h-4 w-4" />
                <span>List</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {filteredPrograms.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
          No programs match the selected brand.
        </div>
      ) : null}

      <ProgramSection
        title="Active Programs"
        description="Current programs available for administration."
        programs={activePrograms}
        onSelectProgram={onSelectProgram}
        viewMode={viewMode}
        alertsByProgramId={alertsByProgramId}
      />

      {inactivePrograms.length > 0 ? (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowInactivePrograms((current) => !current)}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md"
            aria-expanded={showInactivePrograms}
          >
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Inactive Programs</h3>
              <p className="mt-1 text-xs text-zinc-500">
                {showInactivePrograms
                  ? "Past or archived programs that remain available for reference."
                  : `Hidden by default. Show ${inactivePrograms.length} inactive program${inactivePrograms.length !== 1 ? "s" : ""}.`}
              </p>
            </div>
            <ChevronRightIcon
              className={`h-5 w-5 text-zinc-500 transition-transform ${showInactivePrograms ? "rotate-90" : "rotate-0"}`}
            />
          </button>

          {showInactivePrograms ? (
            <ProgramSection
              title=""
              description=""
              programs={inactivePrograms}
              onSelectProgram={onSelectProgram}
              viewMode={viewMode}
              alertsByProgramId={alertsByProgramId}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
