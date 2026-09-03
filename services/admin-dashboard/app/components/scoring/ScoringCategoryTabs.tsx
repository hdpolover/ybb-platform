// services/admin-dashboard/app/components/scoring/ScoringCategoryTabs.tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

// Route-based tab switcher between the fully-funded reviewer queue and the
// self-funded spot-check tab. Both routes share the exact same list
// component (FullyFundedParticipantsAll) with a different `category`.
export function ScoringCategoryTabs({
  programId,
  active,
}: {
  programId: string;
  active: "fully_funded" | "self_funded";
}) {
  const tabs = [
    { key: "fully_funded" as const, label: "Fully Funded", href: `/programs/${programId}/scoring/fully-funded` },
    { key: "self_funded" as const, label: "Self Funded", href: `/programs/${programId}/scoring/self-funded` },
  ];

  return (
    <div className="mb-4 flex gap-1 border-b border-zinc-200">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors",
            active === tab.key
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-zinc-500 hover:text-zinc-900",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
