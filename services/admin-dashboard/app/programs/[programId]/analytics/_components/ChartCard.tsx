// app/programs/[programId]/analytics/_components/ChartCard.tsx

import * as React from "react";

interface ChartCardProps {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, sub, children, className }: ChartCardProps) {
  return (
    <div className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${className ?? ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-400">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
