"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { formatDate } from "@/lib/utils";
import { Button } from "@/src/ui/button";
import { Badge } from "@/src/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import { Separator } from "@/src/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";
import {
  getScoringRubrics,
  upsertScoringRubric,
  percentToFraction,
  fractionToPercent,
  getScoringRubricVersions,
  getScoringRubricVersion,
  Rubric,
  RubricVersionSummary,
  UpsertRubricInput,
  UpsertCategoryInput,
  UpsertCriterionInput,
} from "@/src/shared/api-client";
import {
  validateWeightSums,
  WeightedCategory,
  WeightValidationError,
} from "@/src/shared/scoring-calculation";

// Types (local state representation in percentages)

type CriterionState = {
  id?: string;
  name: string;
  description: string;
  weightPct: number;
  maxScore: number;
  order: number;
};

type CategoryState = {
  id?: string;
  name: string;
  description: string;
  weightPct: number;
  order: number;
  criteria: CriterionState[];
};

type RubricState = {
  name: string;
  description: string;
  /** Pass/fail SCORE cutoff for this stage, 0-100. NOT a weight; never percent-converted. */
  passThreshold: number;
  categories: CategoryState[];
};

// Default pass threshold shown for a stage that has never been saved, matching the
// server's ScoringSchema.passThreshold column default.
const DEFAULT_PASS_THRESHOLD = 75;

// Conversion helpers

function rubricToState(rubric: Rubric | null): RubricState {
  if (!rubric) return { name: "", description: "", passThreshold: DEFAULT_PASS_THRESHOLD, categories: [] };
  return {
    name: rubric.name,
    description: rubric.description ?? "",
    passThreshold: rubric.passThreshold,
    categories: rubric.categories.map((cat, ci) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description ?? "",
      weightPct: Math.round(fractionToPercent(cat.weight) * 100) / 100,
      order: ci,
      criteria: cat.criteria.map((crit, ri) => ({
        id: crit.id,
        name: crit.name,
        description: crit.description ?? "",
        weightPct: Math.round(fractionToPercent(crit.weight) * 100) / 100,
        maxScore: Number(crit.maxScore),
        order: ri,
      })),
    })),
  };
}

function stateToPayload(state: RubricState): UpsertRubricInput {
  return {
    name: state.name || undefined,
    description: state.description || undefined,
    passThreshold: state.passThreshold,
    categories: state.categories.map((cat, ci): UpsertCategoryInput => ({
      id: cat.id,
      name: cat.name,
      description: cat.description || undefined,
      weight: percentToFraction(cat.weightPct),
      order: ci,
      criteria: cat.criteria.map((crit, ri): UpsertCriterionInput => ({
        id: crit.id,
        name: crit.name,
        description: crit.description || undefined,
        weight: percentToFraction(crit.weightPct),
        maxScore: crit.maxScore,
        order: ri,
      })),
    })),
  };
}

// Weight validation

function stateToWeightedCategories(state: RubricState): WeightedCategory[] {
  return state.categories.map((cat) => ({
    categoryId: cat.id ?? `draft-${cat.order}`,
    categoryWeight: percentToFraction(cat.weightPct),
    criteria: cat.criteria.map((crit) => ({
      criterionId: crit.id ?? `draft-${crit.order}`,
      criterionWeight: percentToFraction(crit.weightPct),
      maxScore: crit.maxScore,
    })),
  }));
}

// Sub-component: CriterionRow

function CriterionRow({
  criterion,
  catIdx,
  critIdx,
  onChange,
  onDelete,
}: {
  criterion: CriterionState;
  catIdx: number;
  critIdx: number;
  onChange: (catIdx: number, critIdx: number, updated: Partial<CriterionState>) => void;
  onDelete: (catIdx: number, critIdx: number) => void;
}) {
  const nameId = `criterion-${catIdx}-${critIdx}-name`;
  const descId = `criterion-${catIdx}-${critIdx}-description`;
  const weightId = `criterion-${catIdx}-${critIdx}-weight`;
  const maxScoreId = `criterion-${catIdx}-${critIdx}-max-score`;

  return (
    <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex flex-1 flex-col gap-2">
        <div>
          <Label htmlFor={nameId} className="sr-only">
            Criterion name
          </Label>
          <Input
            id={nameId}
            placeholder="Criterion name"
            value={criterion.name}
            onChange={(e) => onChange(catIdx, critIdx, { name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={descId} className="sr-only">
            Description (optional)
          </Label>
          <Input
            id={descId}
            className="text-xs text-zinc-500"
            placeholder="Description (optional)"
            value={criterion.description}
            onChange={(e) => onChange(catIdx, critIdx, { description: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={weightId} className="text-xs font-normal text-zinc-500">
            Weight %
          </Label>
          <div className="flex items-center gap-1">
            <Input
              id={weightId}
              type="number"
              className="w-20"
              value={criterion.weightPct}
              min={0}
              step={0.01}
              onChange={(e) => onChange(catIdx, critIdx, { weightPct: parseFloat(e.target.value) || 0 })}
            />
            <span className="text-xs text-zinc-500">%</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={maxScoreId} className="text-xs font-normal text-zinc-500">
            Max score
          </Label>
          <div className="flex items-center gap-1">
            <Input
              id={maxScoreId}
              type="number"
              className="w-20"
              value={criterion.maxScore}
              min={0.01}
              step={1}
              onChange={(e) => onChange(catIdx, critIdx, { maxScore: parseFloat(e.target.value) || 100 })}
            />
            <span className="text-xs text-zinc-500">pts</span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-red-600"
          aria-label="Remove"
          title="Remove"
          onClick={() => onDelete(catIdx, critIdx)}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Sub-component: CategoryCard

function CategoryCard({
  category,
  catIdx,
  onCategoryChange,
  onCriterionChange,
  onAddCriterion,
  onDeleteCategory,
  onDeleteCriterion,
}: {
  category: CategoryState;
  catIdx: number;
  onCategoryChange: (catIdx: number, updated: Partial<CategoryState>) => void;
  onCriterionChange: (catIdx: number, critIdx: number, updated: Partial<CriterionState>) => void;
  onAddCriterion: (catIdx: number) => void;
  onDeleteCategory: (catIdx: number) => void;
  onDeleteCriterion: (catIdx: number, critIdx: number) => void;
}) {
  const nameId = `category-${catIdx}-name`;
  const descId = `category-${catIdx}-description`;
  const weightId = `category-${catIdx}-weight`;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <div>
              <Label htmlFor={nameId} className="sr-only">
                Category name
              </Label>
              <Input
                id={nameId}
                className="font-medium"
                placeholder="Category name"
                value={category.name}
                onChange={(e) => onCategoryChange(catIdx, { name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor={descId} className="sr-only">
                Description (optional)
              </Label>
              <Input
                id={descId}
                className="text-sm text-zinc-500"
                placeholder="Description (optional)"
                value={category.description}
                onChange={(e) => onCategoryChange(catIdx, { description: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={weightId} className="text-xs font-normal text-zinc-500">
                Weight %
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  id={weightId}
                  type="number"
                  className="w-20"
                  value={category.weightPct}
                  min={0}
                  step={0.01}
                  onChange={(e) => onCategoryChange(catIdx, { weightPct: parseFloat(e.target.value) || 0 })}
                />
                <span className="text-xs text-zinc-500">%</span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-red-600"
              aria-label="Remove"
              title="Remove"
              onClick={() => onDeleteCategory(catIdx)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          {category.criteria.map((crit, critIdx) => (
            <CriterionRow
              key={critIdx}
              criterion={crit}
              catIdx={catIdx}
              critIdx={critIdx}
              onChange={onCriterionChange}
              onDelete={onDeleteCriterion}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="+ Add criterion"
          onClick={() => onAddCriterion(catIdx)}
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Add criterion
        </Button>
      </CardContent>
    </Card>
  );
}

// Main component

const STAGES = ["application", "interview"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABELS: Record<Stage, string> = {
  application: "Application",
  interview: "Interview",
};

function emptyRubricState(): RubricState {
  return { name: "", description: "", passThreshold: DEFAULT_PASS_THRESHOLD, categories: [] };
}

function emptyCriterion(order: number): CriterionState {
  return { name: "", description: "", weightPct: 0, maxScore: 100, order };
}

function emptyCategory(order: number): CategoryState {
  return { name: "", description: "", weightPct: 0, order, criteria: [] };
}

export function RubricBuilderClient() {
  const params = useParams<{ programId: string }>();
  const rawProgramId = params.programId;
  const programId = useResolvedProgramId(rawProgramId);
  const { accessConfig } = useAuth();

  const [activeStage, setActiveStage] = useState<Stage>("application");
  const [states, setStates] = useState<Record<Stage, RubricState>>({
    application: emptyRubricState(),
    interview: emptyRubricState(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const [versionSummaries, setVersionSummaries] = useState<RubricVersionSummary[]>([]);
  const [versionSummariesError, setVersionSummariesError] = useState<string | null>(null);
  const [viewedVersion, setViewedVersion] = useState<Rubric | null>(null);
  const [viewedVersionError, setViewedVersionError] = useState<string | null>(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);

  // Load both rubrics on mount
  const loadRubrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getScoringRubrics(programId);
      setStates({
        application: rubricToState(data.application),
        interview: rubricToState(data.interview),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rubrics.");
    } finally {
      setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    loadRubrics();
  }, [loadRubrics]);

  // Load version history for the active stage
  const loadVersionSummaries = useCallback(async () => {
    setVersionSummariesError(null);
    try {
      const data = await getScoringRubricVersions(programId, activeStage);
      setVersionSummaries(data);
    } catch (err) {
      setVersionSummariesError(
        err instanceof Error ? err.message : "Failed to load version history.",
      );
    }
  }, [programId, activeStage]);

  useEffect(() => {
    loadVersionSummaries();
  }, [loadVersionSummaries]);

  // Reset stage-scoped transient UI state when switching stages
  useEffect(() => {
    setViewedVersion(null);
    setViewedVersionError(null);
    setShowSaveConfirm(false);
  }, [activeStage]);

  const performSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const payload = stateToPayload(states[activeStage]);
      const result = await upsertScoringRubric(programId, activeStage, payload);
      setStates((prev) => ({
        ...prev,
        [activeStage]: rubricToState(result),
      }));
      setSaveSuccess(true);
      setShowSaveConfirm(false);
      setTimeout(() => setSaveSuccess(false), 3000);
      loadVersionSummaries();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save rubric.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = () => {
    const activeVersion = versionSummaries.find((v) => v.isActive);
    if (activeVersion?.hasSubmittedReviews) {
      setShowSaveConfirm(true);
      return;
    }
    performSave();
  };

  const handleViewVersion = async (version: number) => {
    setViewedVersionError(null);
    setIsLoadingVersion(true);
    try {
      const rubric = await getScoringRubricVersion(programId, activeStage, version);
      setViewedVersion(rubric);
    } catch (err) {
      setViewedVersionError(err instanceof Error ? err.message : "Failed to load version.");
    } finally {
      setIsLoadingVersion(false);
    }
  };

  const updateCategoryField = (catIdx: number, updated: Partial<CategoryState>) => {
    setStates((prev) => {
      const cats = [...prev[activeStage].categories];
      cats[catIdx] = { ...cats[catIdx], ...updated };
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  const updateCriterionField = (catIdx: number, critIdx: number, updated: Partial<CriterionState>) => {
    setStates((prev) => {
      const cats = [...prev[activeStage].categories];
      const criteria = [...cats[catIdx].criteria];
      criteria[critIdx] = { ...criteria[critIdx], ...updated };
      cats[catIdx] = { ...cats[catIdx], criteria };
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  const addCategory = () => {
    setStates((prev) => {
      const cats = [...prev[activeStage].categories];
      cats.push(emptyCategory(cats.length));
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  const deleteCategory = (catIdx: number) => {
    setStates((prev) => {
      const cats = prev[activeStage].categories.filter((_, i) => i !== catIdx);
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  const addCriterion = (catIdx: number) => {
    setStates((prev) => {
      const cats = [...prev[activeStage].categories];
      const criteria = [...cats[catIdx].criteria];
      criteria.push(emptyCriterion(criteria.length));
      cats[catIdx] = { ...cats[catIdx], criteria };
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  const deleteCriterion = (catIdx: number, critIdx: number) => {
    setStates((prev) => {
      const cats = [...prev[activeStage].categories];
      const criteria = cats[catIdx].criteria.filter((_, i) => i !== critIdx);
      cats[catIdx] = { ...cats[catIdx], criteria };
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  // Super-admin gate
  if (!accessConfig.isSuperAdmin) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-zinc-500">
          Rubric management is only available to super admins.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Loading rubrics...</p>;
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-700">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={loadRubrics}>
          Retry
        </Button>
      </div>
    );
  }

  const current = states[activeStage];
  const weightErrors: WeightValidationError[] = validateWeightSums(
    stateToWeightedCategories(current),
  );
  const passThresholdInvalid = current.passThreshold < 0 || current.passThreshold > 100;
  const hasBlockingErrors = weightErrors.length > 0 || passThresholdInvalid;

  // Maps a WeightValidationError's category-scoped path (e.g. "categories[1].criteria")
  // back to that category's display name, so the UI never shows a raw category UUID (or
  // "draft-N" placeholder) to a SuperAdmin. Falls back to the message as-is for the
  // top-level "categories" sum error, which does not interpolate any category identifier.
  function displayWeightError(err: WeightValidationError): string {
    const match = /^categories\[(\d+)\]/.exec(err.path);
    if (!match) return err.message;
    const index = Number(match[1]);
    const category = current.categories[index];
    if (!category) return err.message;
    const rawId = category.id ?? `draft-${category.order}`;
    const displayName = category.name.trim() || `Category ${index + 1}`;
    return err.message.replace(`"${rawId}"`, `"${displayName}"`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Scoring Rubric</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Define categories and criteria for scoring applicants.
        </p>
      </div>

      {/* Stage tabs */}
      <Tabs value={activeStage} onValueChange={(v) => setActiveStage(v as Stage)}>
        <TabsList>
          {STAGES.map((stage) => (
            <TabsTrigger key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Rubric details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="rubric-name">Rubric name</Label>
            <Input
              id="rubric-name"
              className="mt-1"
              placeholder={`${STAGE_LABELS[activeStage]} Rubric`}
              value={current.name}
              onChange={(e) =>
                setStates((prev) => ({
                  ...prev,
                  [activeStage]: { ...prev[activeStage], name: e.target.value },
                }))
              }
            />
          </div>

          {/* Pass threshold: a 0-100 SCORE cutoff, distinct from category/criterion weights
              (which are fractions of 1). Never run through percentToFraction/fractionToPercent. */}
          <div className="w-full md:w-48">
            <Label htmlFor="pass-threshold">Pass threshold</Label>
            <div className="mt-1 flex items-center gap-1">
              <Input
                id="pass-threshold"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={current.passThreshold}
                onChange={(e) =>
                  setStates((prev) => ({
                    ...prev,
                    [activeStage]: { ...prev[activeStage], passThreshold: parseFloat(e.target.value) || 0 },
                  }))
                }
              />
              <span className="text-xs text-zinc-500">/ 100</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Minimum weighted score (0-100) an applicant needs to pass this stage.
            </p>
            {passThresholdInvalid && (
              <p className="mt-1 text-xs text-red-600">Pass threshold must be between 0 and 100.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weight validation errors (blocking) */}
      {weightErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Weights must be fixed before saving:</p>
          <ul className="mt-1 list-disc pl-5">
            {weightErrors.map((err, idx) => (
              <li key={idx}>
                <span className="font-mono text-xs">{err.path}</span>: {displayWeightError(err)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {current.categories.map((cat, catIdx) => (
          <CategoryCard
            key={catIdx}
            category={cat}
            catIdx={catIdx}
            onCategoryChange={updateCategoryField}
            onCriterionChange={updateCriterionField}
            onAddCriterion={addCriterion}
            onDeleteCategory={deleteCategory}
            onDeleteCriterion={deleteCriterion}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        aria-label="+ Add category"
        onClick={addCategory}
      >
        <PlusIcon className="h-4 w-4" aria-hidden="true" />
        Add category
      </Button>

      {/* Save section */}
      <div className="space-y-3">
        <Separator />

        {showSaveConfirm && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>
              This program has submitted reviews scored against the current rubric version.
              Saving creates a new version; those reviews stay pinned to their original version
              and are not affected.
            </p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" disabled={isSaving || hasBlockingErrors} onClick={performSave}>
                {isSaving ? "Saving..." : "Confirm and save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={() => setShowSaveConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm">
            {saveError && <p className="text-red-600">{saveError}</p>}
            {saveSuccess && <p className="text-emerald-600">Rubric saved.</p>}
          </div>
          <Button type="button" disabled={isSaving || hasBlockingErrors} onClick={handleSaveClick}>
            {isSaving ? "Saving..." : "Save rubric"}
          </Button>
        </div>
      </div>

      {/* Version History */}
      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {versionSummariesError && (
            <p className="text-sm text-red-600">{versionSummariesError}</p>
          )}
          {versionSummaries.length === 0 && !versionSummariesError ? (
            <p className="text-sm text-zinc-500">No saved versions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versionSummaries.map((v) => (
                  <TableRow key={v.version}>
                    <TableCell className="font-medium text-zinc-900">Version {v.version}</TableCell>
                    <TableCell className="text-zinc-500">{v.createdByName ?? "Unknown"}</TableCell>
                    <TableCell className="text-zinc-500">{formatDate(v.createdAt)}</TableCell>
                    <TableCell>{v.isActive && <Badge variant="success">Active</Badge>}</TableCell>
                    <TableCell className="text-right">
                      {!v.isActive && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isLoadingVersion}
                          onClick={() => handleViewVersion(v.version)}
                        >
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {viewedVersionError && <p className="text-sm text-red-600">{viewedVersionError}</p>}

          {viewedVersion && (
            <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Version {viewedVersion.version} ({viewedVersion.name || "Untitled"}), read-only
                </h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setViewedVersion(null)}>
                  Close
                </Button>
              </div>
              <div className="space-y-2">
                {viewedVersion.categories.map((cat) => (
                  <div key={cat.id} className="rounded-md border border-zinc-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-900">{cat.name}</span>
                      <span className="text-xs text-zinc-500">
                        {fractionToPercent(cat.weight).toFixed(2)}%
                      </span>
                    </div>
                    {cat.description && (
                      <p className="mt-0.5 text-xs text-zinc-500">{cat.description}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      {cat.criteria.map((crit) => (
                        <div
                          key={crit.id}
                          className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1 text-sm"
                        >
                          <span>{crit.name}</span>
                          <span className="text-xs text-zinc-500">
                            {fractionToPercent(crit.weight).toFixed(2)}% · max {crit.maxScore} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
