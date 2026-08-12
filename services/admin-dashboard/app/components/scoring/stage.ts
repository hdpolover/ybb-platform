// services/admin-dashboard/app/components/scoring/stage.ts

export const STAGES = ["application", "interview"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  application: "Application",
  interview: "Interview",
};

/** Defaults to "application" when the raw value is missing or unrecognized. */
export function parseStage(raw: string | null | undefined): Stage {
  return raw === "interview" ? "interview" : "application";
}
