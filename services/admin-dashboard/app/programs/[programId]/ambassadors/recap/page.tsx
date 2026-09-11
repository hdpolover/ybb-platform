"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  getAmbassadorRecap,
  type AmbassadorRecapResponse,
  type AmbassadorRecapStage,
} from "@/src/shared/api-client";
import { getRecentMonthOptions, type MonthOption } from "@/src/shared/month-options";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/src/admin/page-header";
import { EmptyState } from "@/src/admin/empty-state";
import { Button } from "@/src/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";
import { FilterField } from "@/src/ui/filter-grid";
import { FilterSelect } from "@/src/ui/select";
import { Input } from "@/src/ui/input";

const RECENT_MONTH_COUNT = 6;

const STAGE_OPTIONS: Array<{ value: AmbassadorRecapStage; label: string }> = [
  { value: "referred", label: "Referred" },
  { value: "registered", label: "Registered" },
  { value: "applied", label: "Applied" },
  { value: "accepted", label: "Accepted" },
  { value: "completed", label: "Completed" },
];

/** Default range: the last RECENT_MONTH_COUNT calendar months (matches the API's own default). */
function defaultRange(monthOptions: MonthOption[]): { from: string; to: string } {
  const first = monthOptions[0];
  const last = monthOptions[monthOptions.length - 1];
  return { from: first.from, to: last.to };
}

/** Quotes a CSV field only when it needs it (contains a comma, quote, or newline). */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "programme";
}

export default function AmbassadorRecapPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms } = useAuth();

  const program = useMemo(
    () => accessiblePrograms.find((item) => item.programId === programId || item.programSlug === programId),
    [accessiblePrograms, programId],
  );

  const monthOptions = useMemo(() => getRecentMonthOptions(RECENT_MONTH_COUNT), []);
  const initialRange = useMemo(() => defaultRange(monthOptions), [monthOptions]);

  const [stage, setStage] = useState<AmbassadorRecapStage>("applied");
  const [rangeFrom, setRangeFrom] = useState<string>(initialRange.from);
  const [rangeTo, setRangeTo] = useState<string>(initialRange.to);

  const [recap, setRecap] = useState<AmbassadorRecapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecap = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAmbassadorRecap({ programId, stage, from: rangeFrom, to: rangeTo });
      setRecap(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load affiliate recap");
    } finally {
      setLoading(false);
    }
  }, [programId, stage, rangeFrom, rangeTo]);

  useEffect(() => {
    void loadRecap();
  }, [loadRecap]);

  const selectMonth = useCallback((option: MonthOption) => {
    setRangeFrom(option.from);
    setRangeTo(option.to);
  }, []);

  const programLabel = program?.programName ?? "This programme";

  function handleExportCsv() {
    if (!recap) return;
    const header = ["Ambassador", "Referral Code", ...recap.months.map((m) => m.label), "Total"];
    const rows = recap.rows.map((row) => [
      row.ambassadorName,
      row.referralCode,
      ...recap.months.map((m) => String(row.counts[m.key] ?? 0)),
      String(row.total),
    ]);
    const totalsRow = [
      "Total",
      "",
      ...recap.months.map((m) => String(recap.totals.byMonth[m.key] ?? 0)),
      String(recap.totals.total),
    ];
    const csv = [header, ...rows, totalsRow]
      .map((line) => line.map(csvField).join(","))
      .join("\n");

    // Leading BOM: Sheets reads UTF-8 either way, but Excel on Windows assumes
    // the local ANSI codepage without it and mangles any non-ASCII name. This
    // file exists to be opened in a spreadsheet, so it pays the 3 bytes.
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `affiliate-recap-${slugify(program?.programName ?? programId)}-${stage}-${rangeFrom}-${rangeTo}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliate Recap"
        description={`Monthly ambassador stage counts for ${program?.programName ?? "this programme"} — replaces the manual "REKAP AFFILIATE" spreadsheet.`}
        breadcrumb={
          <Link
            href={`/programs/${programId}/ambassadors`}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Ambassadors
          </Link>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadRecap()} disabled={loading}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleExportCsv} disabled={loading || !recap || recap.rows.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recap Filters</CardTitle>
          <CardDescription>
            Counts show how many ambassador referrals <span className="font-medium text-zinc-700">reached the selected stage</span> inside
            each month — this is not the same as the current-status totals on the Ambassadors list. Month boundaries are computed
            in <span className="font-medium text-zinc-700">Asia/Jakarta (WIB)</span>, not UTC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <FilterField label="Stage" htmlFor="recap-stage">
              <FilterSelect
                id="recap-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as AmbassadorRecapStage)}
              >
                {STAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FilterSelect>
            </FilterField>

            <div className="space-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Recap range</span>
                {monthOptions.map((option) => {
                  const isActive = rangeFrom === option.from && rangeTo === option.to;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => selectMonth(option)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        isActive
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <FilterField label="From" htmlFor="recap-range-from" className="w-36">
                  <Input
                    id="recap-range-from"
                    type="date"
                    value={rangeFrom}
                    max={rangeTo}
                    onChange={(e) => e.target.value && setRangeFrom(e.target.value)}
                    className="h-9 text-sm"
                  />
                </FilterField>
                <FilterField label="To" htmlFor="recap-range-to" className="w-36">
                  <Input
                    id="recap-range-to"
                    type="date"
                    value={rangeTo}
                    min={rangeFrom}
                    onChange={(e) => e.target.value && setRangeTo(e.target.value)}
                    className="h-9 text-sm"
                  />
                </FilterField>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {STAGE_OPTIONS.find((s) => s.value === stage)?.label ?? "Applied"} — by month
          </CardTitle>
          <CardDescription>
            Rows are ambassadors, columns are months. Every cell shows a real count — a `0` means checked-and-none, not
            not-yet-checked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 text-center text-sm text-zinc-400">Loading recap…</div>
          ) : !recap || recap.rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No ambassadors in range"
              description={`${programLabel} has no ambassador activity for the selected stage and range.`}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ambassador</TableHead>
                    <TableHead>Referral Code</TableHead>
                    {recap.months.map((month) => (
                      <TableHead key={month.key} className="text-right">
                        {month.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recap.rows.map((row) => (
                    <TableRow key={row.ambassadorId}>
                      <TableCell className="font-medium text-zinc-900">{row.ambassadorName}</TableCell>
                      <TableCell>
                        <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs">{row.referralCode}</code>
                      </TableCell>
                      {recap.months.map((month) => (
                        <TableCell key={month.key} className="text-right text-zinc-700">
                          {row.counts[month.key] ?? 0}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold text-zinc-900">{row.total}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-zinc-50/80 font-semibold">
                    <TableCell className="text-zinc-900">Total</TableCell>
                    <TableCell />
                    {recap.months.map((month) => (
                      <TableCell key={month.key} className="text-right text-zinc-900">
                        {recap.totals.byMonth[month.key] ?? 0}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-zinc-900">{recap.totals.total}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
