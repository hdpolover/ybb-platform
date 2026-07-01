// app/components/revenue/CurrencyToggle.tsx
"use client";

import type { CurrencyMode } from "./revenue-format";

interface CurrencyToggleProps {
  value: CurrencyMode;
  onChange: (mode: CurrencyMode) => void;
}

/** Segmented IDR/USD toggle — same visual pattern as TrendSection's range switch. */
export function CurrencyToggle({ value, onChange }: CurrencyToggleProps) {
  return (
    <div className="flex gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 text-[11px] text-zinc-600">
      {(["IDR", "USD"] as CurrencyMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          className={`rounded-full px-2.5 py-1 font-medium transition ${
            value === mode ? "bg-blue-600 text-white shadow-sm" : "hover:bg-white"
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
