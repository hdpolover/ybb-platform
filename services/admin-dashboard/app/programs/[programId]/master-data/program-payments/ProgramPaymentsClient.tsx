"use client";

import { useState, useEffect, useCallback } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ProgramPaymentsTable } from "@/app/components/programPaymentsMasterData/options/PaymentOptionTable";
import type { PaymentOptionRow } from "@/app/components/programPaymentsMasterData/options/PaymentOptionTable";
import {
  getPlatformProgramById,
  getPricingTiers,
  updateProgramPaymentInfo,
} from "@/app/platform/api";
import type { PricingTier } from "@/app/platform/api";
import { getExchangeRate } from "@/src/shared/api-client";
import { parseApiDate } from "@/lib/utils";
import { formatInBusinessTz } from "@/lib/datetime";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";

/**
 * A tier is "likely backfilled" when its idrPrice exactly matches what the
 * Phase 1 backfill migration would have produced: round(usdPrice * rate / 1000) * 1000.
 *
 * The literal "% 1000 !== 0" check from the plan would yield 0 hits because the
 * backfill rounds to nearest 1000. Matching the converted value preserves the
 * banner's intent (flag auto-derived prices for admin review) while staying
 * accurate against real backfilled data.
 */
function isLikelyBackfilled(row: PaymentOptionRow, rate: number | null): boolean {
  if (!rate || rate <= 0) return false;
  const expected = Math.round((row.usdPrice * rate) / 1000) * 1000;
  return row.idrPrice === expected;
}

const DEFAULT_PAYMENT_INFO_HTML =
  "<p>Although the amount is displayed in USD for gateway payments, payments will be processed in IDR (Indonesian Rupiah).</p>" +
  "<p>You can pay automatically via gateway (charged in USD and converted at our published rate) or by direct bank transfer in IDR. Choose whichever works for you.</p>";

interface PaymentInfoEditorProps {
  programId: string;
  initialHtml: string | null;
  onSaved?: (newHtml: string | null) => void;
}

function PaymentInfoEditor({ programId, initialHtml, onSaved }: PaymentInfoEditorProps) {
  const [html, setHtml] = useState<string>(initialHtml ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync local state when parent reloads with a fresh value (e.g. after the
  // initial fetch resolves or after a sibling action invalidates the program).
  useEffect(() => {
    if (!editing) {
      setHtml(initialHtml ?? "");
    }
  }, [initialHtml, editing]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const trimmed = html.trim();
      const valueToSend = trimmed.length === 0 ? null : html;
      await updateProgramPaymentInfo(programId, valueToSend);
      setEditing(false);
      onSaved?.(valueToSend);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment information.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setHtml(initialHtml ?? "");
    setEditing(false);
    setError(null);
  };

  const handleUseDefault = () => {
    setHtml(DEFAULT_PAYMENT_INFO_HTML);
  };

  if (!editing) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Payment Information</h3>
            <p className="text-xs text-zinc-500">Shown to participants on the payment page.</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Edit
          </button>
        </div>
        {initialHtml ? (
          <div
            className="prose prose-sm max-w-none text-zinc-700"
            dangerouslySetInnerHTML={{ __html: initialHtml }}
          />
        ) : (
          <p className="text-sm italic text-zinc-400">
            Not set — participants will see a built-in default. Click Edit to customize.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/30 p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Edit Payment Information</h3>
        <p className="text-xs text-zinc-500">
          Use the rich-text editor below. Leave empty to fall back to the built-in default copy.
        </p>
      </div>
      <RichTextEditor
        content={html}
        onChange={setHtml}
        placeholder="Explain how payment works for participants..."
        className="bg-white [&_.ProseMirror]:min-h-[160px]"
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleUseDefault}
          disabled={saving}
          className="ml-auto rounded-md border border-dashed border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 disabled:opacity-60"
        >
          Use default template
        </button>
      </div>
    </section>
  );
}

function parseDateLike(value: unknown): Date | null {
  if (typeof value === "number") {
    const dateFromNumber = new Date(value);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }
  const parsed = parseApiDate((value as string | Date | null | undefined) ?? null);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function tierToRow(tier: PricingTier, index: number): PaymentOptionRow {
  const now = new Date();
  const periodBounds = (tier.validityPeriods ?? []).map((vp) => ({
    period: vp,
    start: parseDateLike(vp.startDate),
    end: parseDateLike(vp.endDate),
  }));
  const activePeriod = periodBounds.find(
    ({ start, end }) => Boolean(start && end && start <= now && now <= end),
  )?.period;
  const upcomingPeriod = periodBounds.find(
    ({ start }) => Boolean(start && start > now),
  )?.period;

  // Render in the canonical business timezone (WIB) so the summary range matches
  // what the admin authored and never shifts an end-of-day date forward a day.
  const fmtRange = (start: unknown, end: unknown) => {
    const startDate = parseDateLike(start);
    const endDate = parseDateLike(end);
    if (!startDate || !endDate) return "—";
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
    return `${formatInBusinessTz(startDate, opts)} - ${formatInBusinessTz(endDate, opts)}`;
  };

  const category =
    tier.feeType === "registration_fee"
      ? ("Registration Fee" as const)
      : tier.name.toLowerCase().includes("2")
        ? ("Program Fee 2" as const)
        : ("Program Fee 1" as const);

  const fundingType = (() => {
    const cats = (tier.allowedCategories ?? []).map((c) => c.toLowerCase());
    if (cats.includes("self_funded") && cats.includes("fully_funded")) return "All" as const;
    if (cats.includes("fully_funded")) return "Fully Funded" as const;
    return "Self Funded" as const;
  })();

  return {
    id: index + 1,
    _id: tier.id,
    optionName: tier.name,
    category,
    fundingType,
    amountUsd: Number(tier.usdPrice),
    usdPrice: Number(tier.usdPrice),
    idrPrice: Number(tier.idrPrice),
    currentActivePeriodLabel: activePeriod ? "Active Period" : null,
    currentActivePeriodRange: activePeriod ? fmtRange(activePeriod.startDate, activePeriod.endDate) : null,
    currentActiveStatusBadge: activePeriod ? "Active Now" : null,
    lastActivePeriodLabel: upcomingPeriod ? "Next Period" : null,
    lastActivePeriodRange: upcomingPeriod ? fmtRange(upcomingPeriod.startDate, upcomingPeriod.endDate) : null,
    lastActiveStatusBadge: upcomingPeriod ? "Upcoming" : null,
    status: tier.isActive ? "Active" : "Inactive",
    description: tier.description ?? "",
    benefits: tier.benefits ?? [],
    requirements: tier.requirements ?? [],
  };
}

export function ProgramPaymentsClient({
  programId,
  programName,
}: {
  programId: string;
  programName: string;
}) {
  const [rows, setRows] = useState<PaymentOptionRow[]>([]);
  const [programUsdInIdr, setProgramUsdInIdr] = useState<number | null>(null);
  const [paymentInfoHtml, setPaymentInfoHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch tiers, exchange rate, and program detail in parallel. Rate and
      // program lookups are non-blocking — if either fails, the page still
      // renders the options table with sensible fallbacks.
      const [tiers, rate, program] = await Promise.all([
        getPricingTiers(programId),
        getExchangeRate(programId).catch(() => null),
        getPlatformProgramById(programId).catch(() => null),
      ]);
      setRows(tiers.map((t, i) => tierToRow(t, i)));
      setProgramUsdInIdr(rate?.usdInIdr ?? null);
      setPaymentInfoHtml(program?.paymentInfoHtml ?? null);
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load payment options. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.optionName.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.fundingType.toLowerCase().includes(q)
    );
  });

  const tiersNeedingReview = rows.filter((row) =>
    isLikelyBackfilled(row, programUsdInIdr),
  );
  const needsBackfillReview = tiersNeedingReview.length > 0;
  const idrFormatter = new Intl.NumberFormat("id-ID");

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="mt-1 text-lg font-bold text-zinc-900">
              {programName} Program Payments
            </h1>
            <p className="text-sm text-zinc-500">
              Manage registration and program fee payment options, along with their active periods.
            </p>
          </div>
        </div>
      </section>

      <PaymentInfoEditor
        programId={programId}
        initialHtml={paymentInfoHtml}
        onSaved={setPaymentInfoHtml}
      />

      {needsBackfillReview && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none text-amber-500" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">
                {tiersNeedingReview.length} tier
                {tiersNeedingReview.length === 1 ? "" : "s"} have auto-generated IDR prices
              </p>
              <p className="text-xs text-amber-800">
                IDR prices were derived from the USD price × exchange rate during the last
                migration. Review and round each to a clean amount (e.g., Rp 250.000 instead of
                Rp 263.000).
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
                {tiersNeedingReview.slice(0, 5).map((tier) => (
                  <li key={tier._id}>
                    • {tier.optionName}: Rp {idrFormatter.format(tier.idrPrice)}
                  </li>
                ))}
                {tiersNeedingReview.length > 5 && (
                  <li className="italic">…and {tiersNeedingReview.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {error ? (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-400">Loading payment options…</div>
        ) : (
          <ProgramPaymentsTable
            data={filtered}
            currentSearch={search}
            onRefresh={load}
            programId={programId}
            programUsdInIdr={programUsdInIdr}
          />
        )}
      </section>
    </main>
  );
}
