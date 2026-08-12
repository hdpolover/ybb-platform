// services/admin-dashboard/app/components/scoring/AssessmentForm.tsx
"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
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
import { Button } from "@/src/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/ui/card";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";
import { EmptyState } from "@/src/admin/empty-state";

interface AssessmentFormProps {
  applicationId: string;
  stage: "application" | "interview";
  /**
   * Presentational only -- does not affect data fetching, validation, payload
   * construction, submit gating, or any other logic below.
   * "stacked" (default): standalone in the page flow, as before.
   * "panel": renders inside the docked scoring panel. The rubric version
   * warning, gate banner, category tables, and notes scroll in a flex-1
   * region while the running total and Save/Submit/Reopen actions stay
   * pinned to the bottom of the panel, per the split-view design.
   */
  layout?: "stacked" | "panel";
  /**
   * Fired after a submit (not a draft save) succeeds. Purely a notification
   * hook for the review queue to advance to the next applicant -- it does
   * not affect submit gating, payload construction, or any logic above.
   */
  onSubmitSuccess?: (review: ApplicationReviewResponseDto) => void;
  /**
   * Fired whenever the in-progress edits (scores/notes) start or stop
   * differing from the last-saved review, so the review queue can warn
   * before navigating away from unsaved work. Purely observational.
   */
  onDirtyChange?: (isDirty: boolean) => void;
}

/** Imperative handle exposed for the review queue's Cmd+Enter/Ctrl+Enter
 *  "submit and advance" shortcut, which can fire while focus is anywhere on
 *  the page, not just inside this form. */
export interface AssessmentFormHandle {
  /** Submits iff the exact same condition that enables the Submit button holds. Otherwise a no-op. */
  submitIfReady: () => void;
}

/** Shallow record equality -- used only for the dirty-state check below. */
function recordsEqual<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

interface SubmitReadiness {
  /** Every criterion across every category has a score. */
  allScored: boolean;
  /** Interview stage's gate is closed and no super-admin override is in effect. */
  gateClosed: boolean;
  /** Same as gateClosed, except a super-admin override lifts it. */
  gateBlocking: boolean;
  /** The ONE definition of "is this review submittable right now". The
   *  Submit button's disabled state, the Enter-on-last-criterion shortcut,
   *  and the Cmd/Ctrl+Enter submitIfReady() handle all read this -- none of
   *  them re-derive any part of it independently. */
  canSubmit: boolean;
}

const NOT_READY: SubmitReadiness = {
  allScored: false,
  gateClosed: false,
  gateBlocking: false,
  canSubmit: false,
};

/**
 * Single source of truth for whether a submit can happen right now. Folds in
 * loading/noRubric/loadError/review-existence too -- those are always true
 * whenever the Submit button is actually on screen (the component early-
 * returns before rendering it otherwise), so this doesn't change the
 * button's effective behavior. It does close a real gap for the keyboard
 * paths, which can fire from a global listener while the form is between
 * applicants (e.g. mid-fetch, still showing "Loading review...") and would
 * otherwise be able to submit stale data for the wrong applicant.
 */
function computeSubmitReadiness(
  review: ApplicationReviewResponseDto | null,
  loading: boolean,
  noRubric: boolean,
  loadError: string | null,
  scores: Record<string, number | null>,
  stage: "application" | "interview",
  isSuperAdmin: boolean,
  overrideApplied: boolean,
  saving: boolean,
): SubmitReadiness {
  if (loading || noRubric || loadError || !review) return NOT_READY;

  const allScored = review.rubric.categories.every((cat) =>
    cat.criteria.every((crit) => scores[crit.id] != null),
  );
  const gateClosed = stage === "interview" && review.gate.reason !== "open" && !review.gate.isOpen;
  const gateBlocking = gateClosed && !(isSuperAdmin && overrideApplied);
  const canSubmit = !saving && !gateBlocking && allScored;

  return { allScored, gateClosed, gateBlocking, canSubmit };
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

export const AssessmentForm = forwardRef<AssessmentFormHandle, AssessmentFormProps>(function AssessmentForm(
  { applicationId, stage, layout = "stacked", onSubmitSuccess, onDirtyChange },
  ref,
) {
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

  // Per-criterion input elements, keyed by criterionId -- lets the Enter-to-
  // next-criterion handler focus siblings without document.getElementById,
  // which would be ambiguous since the desktop dock and the mobile sheet
  // both mount an AssessmentForm for the same criteria at the same time.
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // The single submit-readiness computation for this render (see
  // computeSubmitReadiness above). Mirrored into refs, updated unconditionally
  // on every render below, so the imperative handle exposed further down can
  // read the *latest* value at call time (an async keyboard event) without
  // needing review/scores/etc. in its own dependency array -- that would
  // rebuild the handle's identity every render for no benefit, and was the
  // actual reason the two paths drifted into separate copies before.
  const readiness = computeSubmitReadiness(
    review,
    loading,
    noRubric,
    loadError,
    scores,
    stage,
    accessConfig.isSuperAdmin,
    overrideApplied,
    saving,
  );
  const readinessRef = useRef<SubmitReadiness>(readiness);
  readinessRef.current = readiness;
  // submitPayload is a function declaration below (hoisted), so this closes
  // over each render's fresh applicationId/scores/etc. -- assigned every
  // render, unconditionally, same as readinessRef above.
  const submitPayloadRef = useRef<(status: "draft" | "submitted") => Promise<void>>(async () => {});
  submitPayloadRef.current = submitPayload;

  // Last-saved form state, used only to compute the dirty flag reported via
  // onDirtyChange. Never read by any save/submit/validation logic below.
  const savedSnapshotRef = useRef<FormState | null>(null);
  const lastReportedDirtyRef = useRef(false);

  useEffect(() => {
    const snapshot = savedSnapshotRef.current;
    const isDirty = snapshot
      ? !recordsEqual(scores, snapshot.scores) ||
        !recordsEqual(itemNotes, snapshot.itemNotes) ||
        formNotes !== snapshot.formNotes
      : false;
    if (lastReportedDirtyRef.current !== isDirty) {
      lastReportedDirtyRef.current = isDirty;
      onDirtyChange?.(isDirty);
    }
  }, [scores, itemNotes, formNotes, onDirtyChange]);

  // Exposes submitIfReady() for the review queue's Cmd+Enter/Ctrl+Enter
  // shortcut, which can fire from anywhere on the page, asynchronously,
  // after this render has already committed. Both paths -- this and the
  // Enter-on-last-criterion handler further down -- read the single
  // computeSubmitReadiness() result above (via readinessRef so this handle
  // sees the latest value without needing to be rebuilt every render).
  useImperativeHandle(
    ref,
    () => ({
      submitIfReady: () => {
        if (!readinessRef.current.canSubmit) return;
        void submitPayloadRef.current("submitted");
      },
    }),
    [],
  );

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
        savedSnapshotRef.current = derived;
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
      savedSnapshotRef.current = derived;
      if (status === "submitted") onSubmitSuccess?.(result);
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
      <EmptyState
        title="No rubric configured"
        description={`No ${stage} rubric has been set up for this program yet. A super admin can create one on the Rubric page.`}
      />
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {loadError}
      </div>
    );
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

  // gateClosed/gateBlocking/canSubmit come from the single
  // computeSubmitReadiness() computed above -- not re-derived here.
  const { gateClosed, gateBlocking, canSubmit } = readiness;

  const submitted = review.status === "submitted";
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
      savedSnapshotRef.current = derived;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save review.");
    } finally {
      setSaving(false);
    }
  }

  // Flattened criterion order across all categories, for the Enter-to-next-
  // criterion keyboard shortcut below. Same ordering the table renders in.
  const criterionOrder = review.rubric.categories.flatMap((cat) => cat.criteria.map((crit) => crit.id));

  function handleScoreKeyDown(e: ReactKeyboardEvent<HTMLInputElement>, criterionId: string) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const idx = criterionOrder.indexOf(criterionId);
    const isLast = idx === criterionOrder.length - 1;
    if (isLast) {
      // Reads the same single computeSubmitReadiness() result as the Submit
      // button and submitIfReady() -- not a separate copy of the condition.
      if (canSubmit) void submitPayload("submitted");
      return;
    }
    const nextId = criterionOrder[idx + 1];
    inputRefs.current[nextId]?.focus();
  }

  const rubricVersionWarning = review.hasNewerRubricVersion && (
    <p className="text-xs text-amber-600">
      A newer rubric version exists. This review stays pinned to version{" "}
      {review.schemaVersion} of the rubric.
    </p>
  );

  const gateBanner = gateClosed && (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="flex-1">
        <p className="text-sm text-amber-800">{gateReasonMessage(review)}</p>
        {accessConfig.isSuperAdmin && !overrideApplied && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1">
              <Label htmlFor="override-reason" className="sr-only">
                Reason for override
              </Label>
              <Input
                id="override-reason"
                placeholder="Reason for override"
                value={overrideReasonDraft}
                onChange={(e) => setOverrideReasonDraft(e.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={overrideReasonDraft.trim().length === 0}
              onClick={() => setOverrideApplied(true)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Override and open form
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const categoryCards = review.rubric.categories.map((category, ci) => {
    const letter = letterForCategory(ci);
    return (
      <Card key={category.id}>
        <CardHeader>
          <CardTitle>
            {letter}. {category.name}
          </CardTitle>
          <CardDescription>
            Weight: {fractionToPercent(category.weight).toFixed(2)}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Weight (%)</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {category.criteria.map((criterion, ri) => {
                const rowNumber = `${letter}.${ri + 1}`;
                const error = fieldErrors[criterion.id];
                const scoreId = `score-${criterion.id}`;
                return (
                  <TableRow key={criterion.id}>
                    <TableCell className="align-top">
                      <span>
                        {rowNumber} {criterion.name}
                      </span>
                      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                    </TableCell>
                    <TableCell className="align-top text-zinc-500">
                      {fractionToPercent(criterion.weight).toFixed(2)}
                    </TableCell>
                    <TableCell className="align-top">
                      <Label htmlFor={scoreId} className="sr-only">
                        Score for {criterion.name}
                      </Label>
                      <Input
                        id={scoreId}
                        ref={(el) => {
                          inputRefs.current[criterion.id] = el;
                        }}
                        type="number"
                        min={0}
                        max={criterion.maxScore}
                        step={1}
                        value={scores[criterion.id] ?? ""}
                        disabled={inputsDisabled}
                        onChange={(e) =>
                          handleScoreChange(criterion.id, criterion.maxScore, e.target.value)
                        }
                        onKeyDown={(e) => handleScoreKeyDown(e, criterion.id)}
                        className="w-24"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <p className="mt-3 text-xs text-zinc-500">
            Subtotal: {categorySubtotal(category, scores)}
          </p>
        </CardContent>
      </Card>
    );
  });

  const totalCard = (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <span className="text-sm font-medium text-zinc-600">Total Score</span>
        <span className="text-2xl font-bold text-zinc-900">{grandTotal}</span>
      </CardContent>
    </Card>
  );

  const notesSection = (
    <div>
      <Label htmlFor="assessment-notes">Notes</Label>
      <textarea
        id="assessment-notes"
        className="mt-1 flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-zinc-100"
        rows={3}
        value={formNotes}
        disabled={submitted}
        onChange={(e) => setFormNotes(e.target.value)}
      />
    </div>
  );

  const actionsSection = submitted ? (
    <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
      <div className="text-sm">
        {saveError && <p className="text-red-600">{saveError}</p>}
      </div>
      <Button type="button" variant="secondary" disabled={saving} onClick={handleReopen}>
        {saving ? "Reopening..." : "Reopen"}
      </Button>
    </div>
  ) : (
    <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
      <div className="text-sm">
        {saveError && <p className="text-red-600">{saveError}</p>}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={saving || gateBlocking}
          onClick={() => submitPayload("draft")}
        >
          {saving ? "Saving..." : "Save draft"}
        </Button>
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={() => submitPayload("submitted")}
        >
          {saving ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );

  if (layout === "panel") {
    // Docked scoring panel: criteria/notes scroll in the flex-1 region while
    // the total and actions stay pinned to the bottom of the panel.
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {rubricVersionWarning}
          {gateBanner}
          {categoryCards}
          {notesSection}
        </div>
        <div className="shrink-0 space-y-3 border-t border-zinc-200 bg-white pt-4">
          {totalCard}
          {actionsSection}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rubricVersionWarning}
      {gateBanner}
      {categoryCards}
      {totalCard}
      {notesSection}
      {actionsSection}
    </div>
  );
});
