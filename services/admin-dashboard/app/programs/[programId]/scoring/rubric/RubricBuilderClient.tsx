"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  getScoringRubrics,
  upsertScoringRubric,
  percentToFraction,
  fractionToPercent,
  Rubric,
  UpsertRubricInput,
  UpsertCategoryInput,
  UpsertCriterionInput,
} from "@/src/shared/api-client";

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
  categories: CategoryState[];
};

// Conversion helpers

function rubricToState(rubric: Rubric | null): RubricState {
  if (!rubric) return { name: "", description: "", categories: [] };
  return {
    name: rubric.name,
    description: rubric.description ?? "",
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

// Weight sum helpers

function sumWeights(items: { weightPct: number }[]): number {
  return items.reduce((acc, item) => acc + (item.weightPct || 0), 0);
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
  return (
    <div className="flex items-start gap-2 rounded border bg-muted/20 p-2">
      <div className="flex flex-1 flex-col gap-1">
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Criterion name"
          value={criterion.name}
          onChange={(e) => onChange(catIdx, critIdx, { name: e.target.value })}
        />
        <input
          className="w-full rounded border px-2 py-1 text-xs text-muted-foreground"
          placeholder="Description (optional)"
          value={criterion.description}
          onChange={(e) => onChange(catIdx, critIdx, { description: e.target.value })}
        />
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="w-20 rounded border px-2 py-1 text-sm"
            placeholder="Weight %"
            value={criterion.weightPct}
            min={0}
            step={0.01}
            onChange={(e) => onChange(catIdx, critIdx, { weightPct: parseFloat(e.target.value) || 0 })}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="w-20 rounded border px-2 py-1 text-sm"
            placeholder="Max score"
            value={criterion.maxScore}
            min={0.01}
            step={1}
            onChange={(e) => onChange(catIdx, critIdx, { maxScore: parseFloat(e.target.value) || 100 })}
          />
          <span className="text-xs text-muted-foreground">pts</span>
        </div>
      </div>
      <button
        type="button"
        className="mt-1 text-xs text-destructive hover:underline"
        onClick={() => onDelete(catIdx, critIdx)}
      >
        Remove
      </button>
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
  const critSum = sumWeights(category.criteria);
  const critSumWarning = category.criteria.length > 0 && Math.abs(critSum - 100) > 0.01;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <input
            className="w-full rounded border px-3 py-1.5 font-medium"
            placeholder="Category name"
            value={category.name}
            onChange={(e) => onCategoryChange(catIdx, { name: e.target.value })}
          />
          <input
            className="w-full rounded border px-3 py-1 text-sm text-muted-foreground"
            placeholder="Description (optional)"
            value={category.description}
            onChange={(e) => onCategoryChange(catIdx, { description: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="w-20 rounded border px-2 py-1.5 text-sm"
            placeholder="Weight %"
            value={category.weightPct}
            min={0}
            step={0.01}
            onChange={(e) => onCategoryChange(catIdx, { weightPct: parseFloat(e.target.value) || 0 })}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <button
          type="button"
          className="text-xs text-destructive hover:underline"
          onClick={() => onDeleteCategory(catIdx)}
        >
          Remove
        </button>
      </div>

      <div className="mb-2 space-y-2">
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

      {critSumWarning && (
        <p className="mb-2 text-xs text-amber-600">
          Criterion weights sum to {critSum.toFixed(1)}% (should be 100%). Scores will be normalized on computation.
        </p>
      )}

      <button
        type="button"
        className="text-xs text-primary hover:underline"
        onClick={() => onAddCriterion(catIdx)}
      >
        + Add criterion
      </button>
    </div>
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
  return { name: "", description: "", categories: [] };
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

  const handleSave = async () => {
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
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save rubric.");
    } finally {
      setIsSaving(false);
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
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Rubric management is only available to super admins.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading rubrics...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{error}</p>
        <button type="button" className="mt-2 text-sm text-primary underline" onClick={loadRubrics}>
          Retry
        </button>
      </div>
    );
  }

  const current = states[activeStage];
  const catSum = sumWeights(current.categories);
  const catSumWarning = current.categories.length > 0 && Math.abs(catSum - 100) > 0.01;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Scoring Rubric</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define categories and criteria for scoring applicants.
        </p>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-2 border-b">
        {STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => setActiveStage(stage)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeStage === stage
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {STAGE_LABELS[stage]}
          </button>
        ))}
      </div>

      {/* Rubric name */}
      <div>
        <label className="mb-1 block text-sm font-medium">Rubric name</label>
        <input
          className="w-full rounded border px-3 py-2"
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

      {/* Category weight summary */}
      {catSumWarning && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Category weights sum to {catSum.toFixed(1)}% (should be 100%). Scores will be normalized on computation.
        </p>
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

      <button
        type="button"
        className="w-full rounded border-2 border-dashed py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        onClick={addCategory}
      >
        + Add category
      </button>

      {/* Save section */}
      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-sm">
          {saveError && <p className="text-destructive">{saveError}</p>}
          {saveSuccess && <p className="text-green-600">Rubric saved.</p>}
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save rubric"}
        </button>
      </div>
    </div>
  );
}
