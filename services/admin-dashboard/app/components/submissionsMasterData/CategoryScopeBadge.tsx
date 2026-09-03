// app/components/submissionsMasterData/CategoryScopeBadge.tsx
"use client";

const CATEGORY_LABELS: Record<string, string> = {
  fully_funded: "Fully Funded",
  self_funded: "Self Funded",
};

/**
 * Compact badge showing which application category a form field or essay is
 * scoped to. Renders nothing when the item applies to every category (empty
 * or missing allowedCategories) so the common case stays visually quiet.
 */
export function CategoryScopeBadge({ allowedCategories }: { allowedCategories?: string[] | null }) {
  if (!allowedCategories || allowedCategories.length === 0) return null;

  const label = allowedCategories.map((category) => CATEGORY_LABELS[category] ?? category).join(" + ");

  return (
    <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-indigo-50 text-indigo-700">
      {label} only
    </span>
  );
}

export const CATEGORY_SCOPE_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "fully_funded", label: "Fully Funded only" },
  { value: "self_funded", label: "Self Funded only" },
];
