// app/components/reminders/wib-time.ts

/**
 * WIB (Asia/Jakarta, UTC+7, no DST) helpers for the reminder scheduler.
 *
 * The whole point is to be explicit about what a scheduled time means. The
 * admin picks a WIB wall clock; we send it to the API with a literal +07:00
 * offset so the stored instant is exactly the moment they meant, whatever
 * timezone their laptop or the API container happens to be in. The API rejects
 * an offset-less datetime outright.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ISO instant -> the `YYYY-MM-DDTHH:mm` an <input type="datetime-local"> wants. */
export function toWibInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  return new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

/** `YYYY-MM-DDTHH:mm` from the input -> an ISO string carrying its WIB offset. */
export function fromWibInputValue(value: string): string {
  return `${value}:00+07:00`;
}

/** ISO instant -> "09 Sep 2026, 08:00 WIB". */
export function formatWib(iso: string | null | undefined): string {
  if (!iso) return "—";
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "—";
  const wall = new Date(instant.getTime() + WIB_OFFSET_MS);
  const date = wall.toISOString().slice(0, 10);
  const time = wall.toISOString().slice(11, 16);
  const [year, month, day] = date.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${day} ${months[Number(month) - 1]} ${year}, ${time} WIB`;
}

/** The soonest sensible default: tomorrow 08:00 WIB, as an input value. */
export function defaultScheduleInputValue(now: Date = new Date()): string {
  const wall = new Date(now.getTime() + WIB_OFFSET_MS);
  const tomorrow = new Date(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 1, 8, 0),
  );
  return tomorrow.toISOString().slice(0, 16);
}
