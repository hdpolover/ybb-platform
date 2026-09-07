// services/admin-dashboard/lib/registration-date-warnings.ts

/**
 * Advisory (non-blocking) checks for a program's registration dates vs. its
 * pricing-tier validity periods. These never correct data or block saving,
 * they only tell an admin what looks inconsistent so they can pick which
 * side to fix. See docs on the four checks below for the recurring prod
 * incidents each one is guarding against.
 */
import { BUSINESS_TIMEZONE, formatInBusinessTz, parseToInstant } from "./datetime.ts";

const FUNDING_CATEGORIES = ["self_funded", "fully_funded"] as const;
type FundingCategory = (typeof FUNDING_CATEGORIES)[number];

const CATEGORY_LABEL: Record<FundingCategory, string> = {
  self_funded: "Self Funded",
  fully_funded: "Fully Funded",
};

export type WarningPeriod = {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
};

export type WarningTier = {
  feeType?: string | null;
  allowedCategories?: string[] | null;
  validityPeriods?: WarningPeriod[] | null;
};

export type RegistrationWarningsInput = {
  registrationOpenDate?: string | null;
  registrationCloseDate?: string | null;
  tiers: WarningTier[];
  now?: Date;
};

/** One human-readable, WIB-rendered advisory. */
export type RegistrationWarning = { id: string; message: string };

const DATE_OPTS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const DATETIME_OPTS: Intl.DateTimeFormatOptions = { ...DATE_OPTS, hour: "2-digit", minute: "2-digit" };

const fmtDate = (v: string | Date) => formatInBusinessTz(v, DATE_OPTS);
const fmtDateTime = (v: string | Date) => formatInBusinessTz(v, DATETIME_OPTS);

function isRegistrationFeeTier(tier: WarningTier): boolean {
  return (tier.feeType ?? "").toLowerCase() === "registration_fee";
}

function tierCategories(tier: WarningTier): FundingCategory[] {
  return (tier.allowedCategories ?? [])
    .map((c) => c.toLowerCase())
    .filter((c): c is FundingCategory => (FUNDING_CATEGORIES as readonly string[]).includes(c));
}

/** A validity period covers `now` when now falls within [start, end]. */
function periodCoversNow(period: WarningPeriod, now: Date): boolean {
  const start = parseToInstant(period.startDate);
  const end = parseToInstant(period.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= now && now <= end;
}

/** Latest endDate across a set of periods, or null if there are none / all invalid. */
function latestPeriodEnd(periods: WarningPeriod[]): Date | null {
  let latest: Date | null = null;
  for (const p of periods) {
    const end = parseToInstant(p.endDate);
    if (Number.isNaN(end.getTime())) continue;
    if (!latest || end > latest) latest = end;
  }
  return latest;
}

/** WIB calendar-day key, so instants that land on the same Jakarta day compare equal. */
function wibDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE }).format(d);
}

/**
 * An instant that is exactly 00:00:00.000 UTC is what you get from storing a
 * bare "YYYY-MM-DD" with no time component. In WIB (UTC+7) that reads as
 * 07:00 the next morning, so a date meant as "through 15 July" cuts
 * registration off 17 hours early. This has hit prod five times.
 */
function looksLikeBareCalendarDay(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

/**
 * Compute advisory warnings comparing a program's registration dates against
 * its pricing-tier validity periods. Never throws on missing/malformed
 * dates, warnings are simply skipped when there isn't enough data to judge.
 */
export function computeRegistrationDateWarnings({
  registrationOpenDate,
  registrationCloseDate,
  tiers,
  now = new Date(),
}: RegistrationWarningsInput): RegistrationWarning[] {
  const warnings: RegistrationWarning[] = [];
  const closeInstant = registrationCloseDate ? parseToInstant(registrationCloseDate) : null;
  const closeIsValid = closeInstant !== null && !Number.isNaN(closeInstant.getTime());

  const registrationFeeTiers = tiers.filter(isRegistrationFeeTier);

  // Check 1: program-level close date vs. the latest registration-fee tier window.
  if (closeIsValid) {
    const latestRegFeeEnd = latestPeriodEnd(
      registrationFeeTiers.flatMap((t) => t.validityPeriods ?? []),
    );
    if (latestRegFeeEnd && wibDayKey(latestRegFeeEnd) !== wibDayKey(closeInstant)) {
      const tierIsLater = latestRegFeeEnd > closeInstant;
      warnings.push({
        id: "close-vs-tier-window",
        message: tierIsLater
          ? `The program's registration close date (${fmtDate(closeInstant)}) is earlier than the latest registration fee window, which runs through ${fmtDate(latestRegFeeEnd)}. Participants can still pay after the program shows as closed. Update whichever date is wrong.`
          : `The program's registration close date (${fmtDate(closeInstant)}) is later than the latest registration fee window, which ends ${fmtDate(latestRegFeeEnd)}. Registration will show as open with no way to pay. Update whichever date is wrong.`,
      });
    }
  }

  // Determine which funding categories this program actually offers, from
  // the categories that appear on ANY of its pricing tiers (there is no
  // separate "offered categories" field on the program itself).
  const offeredCategories = new Set<FundingCategory>();
  for (const tier of tiers) {
    for (const cat of tierCategories(tier)) offeredCategories.add(cat);
  }

  for (const category of FUNDING_CATEGORIES) {
    if (!offeredCategories.has(category)) continue;
    const label = CATEGORY_LABEL[category];
    const categoryRegFeeTiers = registrationFeeTiers.filter((t) => tierCategories(t).includes(category));

    // Check 3: category offered, but no registration-fee tier exists for it at all.
    if (categoryRegFeeTiers.length === 0) {
      warnings.push({
        id: `no-reg-fee-tier-${category}`,
        message: `${label} has no registration fee pricing tier at all. Create one, otherwise this category can never be paid for.`,
      });
      continue;
    }

    // Check 2: tier(s) exist, but none of their windows cover today.
    const periods = categoryRegFeeTiers.flatMap((t) => t.validityPeriods ?? []);
    const coversNow = periods.some((p) => periodCoversNow(p, now));
    if (!coversNow) {
      warnings.push({
        id: `no-active-window-${category}`,
        message: `${label} has no registration fee window covering today. This category is currently invisible to participants and cannot be paid for. Add a validity period covering today.`,
      });
    }
  }

  // Check 4: bare-calendar-day instants, on the program close date and on
  // every registration-fee validity period end.
  const bareDayCandidates: { label: string; instant: Date }[] = [];
  if (closeIsValid) bareDayCandidates.push({ label: "The program's registration close date", instant: closeInstant });
  for (const tier of registrationFeeTiers) {
    for (const period of tier.validityPeriods ?? []) {
      const end = parseToInstant(period.endDate);
      if (!Number.isNaN(end.getTime())) {
        bareDayCandidates.push({ label: "A registration fee window's end date", instant: end });
      }
    }
  }
  for (const { label, instant } of bareDayCandidates) {
    if (!looksLikeBareCalendarDay(instant)) continue;
    warnings.push({
      id: `bare-calendar-day-${label}-${instant.toISOString()}`,
      message: `${label} is stored as midnight UTC, which is ${fmtDateTime(instant)} WIB, not end of day. If this was meant to close registration at the end of that day, it is actually cutting participants off 17 hours early that morning. Re-enter it with an explicit end-of-day time.`,
    });
  }

  return warnings;
}
