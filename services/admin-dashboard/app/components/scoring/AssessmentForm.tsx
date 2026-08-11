// services/admin-dashboard/app/components/scoring/AssessmentForm.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  getApplicationReview,
  upsertApplicationReview,
  fractionToPercent,
  ApiError,
  ApplicationReviewResponseDto,
  RubricCategory,
  UpsertApplicationReviewDto,
  UpsertApplicationReviewItemInput,
} from "@/src/shared/api-client";
import {
  calculateWeightedTotal,
  WeightedCategory,
  ScoreInput,
} from "@/src/shared/scoring-calculation";

interface AssessmentFormProps {
  applicationId: string;
  stage: "application" | "interview";
}

type FormState = {
  scores: Record<string, number | null>;
  itemNotes: Record<string, string>;
  formNotes: string;
};

/** Derives editable local state from a fresh review response. Pure, no hook dependency needed. */
function deriveFormState(review: ApplicationReviewResponseDto): FormState {
  const scores: Record<string, number | null> = {};
  const itemNotes: Record<string, string> = {};
  for (const category of review.rubric.categories) {
    for (const criterion of category.criteria) {
      scores[criterion.id] = null;
      itemNotes[criterion.id] = "";
    }
  }
  for (const item of review.scoreItems) {
    scores[item.criterionId] = item.score;
    itemNotes[item.criterionId] = item.notes ?? "";
  }
  return { scores, itemNotes, formNotes: review.notes ?? "" };
}

function letterForCategory(categoryIndex: number): string {
  return String.fromCharCode(65 + categoryIndex);
}

function categorySubtotal(
  category: RubricCategory,
  scores: Record<string, number | null>,
): number {
  const sum = category.criteria.reduce((acc, crit) => {
    const score = scores[crit.id];
    if (score == null) return acc;
    return acc + score * crit.weight * category.weight;
  }, 0);
  return Math.round(sum * 100) / 100;
}

function gateReasonMessage(review: ApplicationReviewResponseDto): string | null {
  switch (review.gate.reason) {
    case "no_application_review":
      return "The application stage has not been reviewed yet.";
    case "application_draft":
      return "The application stage review is still a draft.";
    case "below_threshold":
      return `The application score (${review.gate.applicationTotal}) is below the pass threshold (${review.gate.applicationThreshold}).`;
    case "open":
    default:
      return null;
  }
}

function parseItemFieldIndex(path: string): number | null {
  const match = /^items\[(\d+)\]/.exec(path);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function AssessmentForm({ applicationId, stage }: AssessmentFormProps) {
  const { accessConfig } = useAuth();

  const [review, setReview] = useState<ApplicationReviewResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [noRubric, setNoRubric] = useState(false);

  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [formNotes, setFormNotes] = useState("");

  const [overrideReasonDraft, setOverrideReasonDraft] = useState("");
  const [overrideApplied, setOverrideApplied] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      setNoRubric(false);
      try {
        const result = await getApplicationReview(applicationId, stage);
        if (cancelled) return;
        setReview(result);
        const derived = deriveFormState(result);
        setScores(derived.scores);
        setItemNotes(derived.itemNotes);
        setFormNotes(derived.formNotes);
        setOverrideApplied(false);
        setOverrideReasonDraft("");
        setSaveError(null);
        setFieldErrors({});
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 409) {
          setNoRubric(true);
        } else {
          setLoadError(err instanceof Error ? err.message : "Failed to load review.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [applicationId, stage]);

  function buildItemsPayload(): UpsertApplicationReviewItemInput[] {
    return Object.entries(scores)
      .filter((entry): entry is [string, number] => entry[1] != null)
      .map(([criterionId, score]) => ({
        criterionId,
        score,
        notes: itemNotes[criterionId] || undefined,
      }));
  }

  async function submitPayload(status: "draft" | "submitted") {
    if (!review) return;
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    const items = buildItemsPayload();
    try {
      const payload: UpsertApplicationReviewDto = {
        status,
        notes: formNotes || undefined,
        items,
        overrideReason: overrideApplied ? overrideReasonDraft : undefined,
      };
      const result = await upsertApplicationReview(applicationId, stage, payload);
      setReview(result);
      const derived = deriveFormState(result);
      setScores(derived.scores);
      setItemNotes(derived.itemNotes);
      setFormNotes(derived.formNotes);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const perCriterion: Record<string, string> = {};
        const formLevelMessages: string[] = [];
        for (const fieldError of err.fieldErrors) {
          const index = parseItemFieldIndex(fieldError.path);
          const item = index != null ? items[index] : undefined;
          if (item) {
            perCriterion[item.criterionId] = fieldError.message;
          } else {
            formLevelMessages.push(fieldError.message);
          }
        }
        setFieldErrors(perCriterion);
        setSaveError(formLevelMessages.length > 0 ? formLevelMessages.join(" ") : err.message);
      } else {
        setSaveError(err instanceof Error ? err.message : "Failed to save review.");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleScoreChange(criterionId: string, maxScore: number, raw: string) {
    if (raw === "") {
      setScores((prev) => ({ ...prev, [criterionId]: null }));
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(Math.max(parsed, 0), maxScore);
    setScores((prev) => ({ ...prev, [criterionId]: clamped }));
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading review...</p>;
  }

  if (noRubric) {
    return (
      <p className="text-sm text-zinc-500">
        No {stage} rubric has been set up for this program yet. A super admin can create one on
        the Rubric page.
      </p>
    );
  }

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  if (!review) {
    return null;
  }

  const weightedCategories: WeightedCategory[] = review.rubric.categories.map((cat) => ({
    categoryId: cat.id,
    categoryWeight: cat.weight,
    criteria: cat.criteria.map((crit) => ({
      criterionId: crit.id,
      criterionWeight: crit.weight,
      maxScore: crit.maxScore,
    })),
  }));
  const scoreInputs: ScoreInput[] = Object.entries(scores)
    .filter((entry): entry is [string, number] => entry[1] != null)
    .map(([criterionId, score]) => ({ criterionId, score }));
  const grandTotal = calculateWeightedTotal(weightedCategories, scoreInputs);

  const allScored = review.rubric.categories.every((cat) =>
    cat.criteria.every((crit) => scores[crit.id] != null),
  );

  const submitted = review.status === "submitted";
  const gateClosed = stage === "interview" && review.gate.reason !== "open" && !review.gate.isOpen;
  const gateBlocking = gateClosed && !(accessConfig.isSuperAdmin && overrideApplied);
  const inputsDisabled = submitted || gateBlocking;

  async function handleReopen() {
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      const items = buildItemsPayload();
      const payload: UpsertApplicationReviewDto = {
        status: "draft",
        notes: formNotes || undefined,
        items,
        overrideReason: overrideApplied ? overrideReasonDraft : undefined,
      };
      const result = await upsertApplicationReview(applicationId, stage, payload);
      setReview(result);
      const derived = deriveFormState(result);
      setScores(derived.scores);
      setItemNotes(derived.itemNotes);
      setFormNotes(derived.formNotes);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {review.hasNewerRubricVersion && (
        <p className="text-xs text-amber-600">
          A newer rubric version exists. This review stays pinned to version{" "}
          {review.schemaVersion} of the rubric.
        </p>
      )}

      {gateClosed && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{gateReasonMessage(review)}</p>
          {accessConfig.isSuperAdmin && !overrideApplied && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                className="flex-1 rounded border px-3 py-1.5 text-sm"
                placeholder="Reason for override"
                value={overrideReasonDraft}
                onChange={(e) => setOverrideReasonDraft(e.target.value)}
              />
              <button
                type="button"
                disabled={overrideReasonDraft.trim().length === 0}
                onClick={() => setOverrideApplied(true)}
                className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Override and open form
              </button>
            </div>
          )}
        </div>
      )}

      {review.rubric.categories.map((category, ci) => {
        const letter = letterForCategory(ci);
        return (
          <div key={category.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h3 className="font-medium">
                {letter}. {category.name}
              </h3>
              <p className="text-xs text-zinc-500">
                Weight: {fractionToPercent(category.weight).toFixed(2)}%
              </p>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-zinc-500">
                  <th className="py-1.5 pr-2 font-medium">Component</th>
                  <th className="py-1.5 pr-2 font-medium">Weight (%)</th>
                  <th className="py-1.5 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {category.criteria.map((criterion, ri) => {
                  const rowNumber = `${letter}.${ri + 1}`;
                  const error = fieldErrors[criterion.id];
                  return (
                    <tr key={criterion.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 align-top">
                        <span>
                          {rowNumber} {criterion.name}
                        </span>
                        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                      </td>
                      <td className="py-2 pr-2 align-top text-zinc-500">
                        {fractionToPercent(criterion.weight).toFixed(2)}
                      </td>
                      <td className="py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          max={criterion.maxScore}
                          step={1}
                          value={scores[criterion.id] ?? ""}
                          disabled={inputsDisabled}
                          onChange={(e) =>
                            handleScoreChange(criterion.id, criterion.maxScore, e.target.value)
                          }
                          className="w-24 rounded border px-2 py-1 disabled:bg-zinc-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="mt-2 text-xs text-zinc-500">
              Subtotal: {categorySubtotal(category, scores)}
            </p>
          </div>
        );
      })}

      <div className="flex items-center justify-between border-t pt-4 text-base font-semibold">
        <span>Total Score</span>
        <span>{grandTotal}</span>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Notes</label>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm disabled:bg-zinc-100"
          rows={3}
          value={formNotes}
          disabled={submitted}
          onChange={(e) => setFormNotes(e.target.value)}
        />
      </div>

      {submitted ? (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm">
            {saveError && <p className="text-red-600">{saveError}</p>}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleReopen}
            className="rounded border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
          >
            {saving ? "Reopening..." : "Reopen"}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm">
            {saveError && <p className="text-red-600">{saveError}</p>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || gateBlocking}
              onClick={() => submitPayload("draft")}
              className="rounded border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save draft"}
            </button>
            <button
              type="button"
              disabled={saving || gateBlocking || !allScored}
              onClick={() => submitPayload("submitted")}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
