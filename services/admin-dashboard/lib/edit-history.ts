// services/admin-dashboard/lib/edit-history.ts
// Labels and display values for the participant detail "Edit History" tab.
import type { Application, ApplicationEditHistoryEntry, SubmissionSectionAdmin } from "@/src/shared/api-client";
import { formatFieldValue, type FieldFormatShape } from "@/lib/field-value-format";

export const EMPTY_VALUE = "(empty)";

const QUESTION_MAX_CHARS = 60;
const LONG_VALUE_CHARS = 160;
const LONG_VALUE_LINES = 3;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIXED_LABELS: Record<string, string> = { "participant.fullName": "Full name" };

type EssayRef = Pick<NonNullable<Application["essays"]>[number], "id" | "question">;

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** "twibbonLink" / "knowledge_source" -> "Twibbon link" / "Knowledge source". */
function humanizeKey(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : name;
}

/** Change key -> label: "<store>.<field>" from the form, "essayAnswers.<essayId>" from the essay question (truncated). */
export function buildChangeLabels(
  sections: SubmissionSectionAdmin[] | undefined,
  essays: EssayRef[] | undefined,
): ReadonlyMap<string, string> {
  return new Map<string, string>([
    ...(essays ?? []).map((e): [string, string] => [`essayAnswers.${e.id}`, truncate(e.question, QUESTION_MAX_CHARS)]),
    // Form labels win over an essay question on the (unlikely) same key.
    ...(sections ?? []).flatMap((s) => s.fields.map((f): [string, string] => [`${f.store}.${f.name}`, f.label])),
  ]);
}

/** Change key -> the form field it edits, so old/new values format like the rest of the page. */
export function buildChangeFields(sections: SubmissionSectionAdmin[] | undefined): ReadonlyMap<string, FieldFormatShape> {
  return new Map((sections ?? []).flatMap((s) => s.fields.map((f): [string, FieldFormatShape] => [`${f.store}.${f.name}`, f])));
}

/** The form field behind a change key; keys the form doesn't define still format by field name (e.g. nationality). */
export function changeField(key: string, fields: ReadonlyMap<string, FieldFormatShape>): FieldFormatShape {
  const dot = key.indexOf(".");
  return fields.get(key) ?? { name: dot === -1 ? key : key.slice(dot + 1) };
}

/** Human label for a change key; unknown keys fall back to the humanized field name. */
export function changeLabel(key: string, labels: ReadonlyMap<string, string>): string {
  const known = labels.get(key) ?? FIXED_LABELS[key];
  if (known) return known;
  const dot = key.indexOf(".");
  const field = dot === -1 ? key : key.slice(dot + 1);
  // An essay that no longer exists on the program: its id is meaningless to an admin.
  if (key.startsWith("essayAnswers.") && UUID_RE.test(field)) return "Essay answer";
  return humanizeKey(field);
}

/**
 * Old/new JSON value as text: strings formatted for `field` when given (else as-is), everything else JSON;
 * null, blank and {} / [] read "(empty)".
 */
export function formatChangeValue(value: unknown, field?: FieldFormatShape): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  if (typeof value === "string") {
    if (value.trim() === "") return EMPTY_VALUE;
    return field ? formatFieldValue(value, field) : value;
  }
  if (typeof value === "object") return Object.keys(value).length === 0 ? EMPTY_VALUE : JSON.stringify(value);
  return String(value);
}

/** True when a value should start clamped behind a "Show more" toggle. */
export function isLongValue(text: string): boolean {
  return text.length > LONG_VALUE_CHARS || text.split("\n").length > LONG_VALUE_LINES;
}

/**
 * Change key -> display text of the `old` value of its earliest admin edit, i.e. the answer as the participant
 * submitted it, formatted like the rest of the page ("(empty)" when it was blank).
 */
export function originalValuesByKey(
  entries: ReadonlyArray<Pick<ApplicationEditHistoryEntry, "editedAt" | "changes">>,
  fields: ReadonlyMap<string, FieldFormatShape>,
): ReadonlyMap<string, string> {
  // The API sends newest first; sorted anyway so the result doesn't depend on that.
  const oldestFirst = [...entries].sort((a, b) => Date.parse(a.editedAt) - Date.parse(b.editedAt));
  const originals = new Map<string, string>();
  for (const entry of oldestFirst) {
    for (const change of entry.changes) {
      if (!originals.has(change.key)) originals.set(change.key, formatChangeValue(change.old, changeField(change.key, fields)));
    }
  }
  return originals;
}
