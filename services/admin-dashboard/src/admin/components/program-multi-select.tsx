// services/admin-dashboard/src/admin/components/program-multi-select.tsx
"use client";

import * as React from "react";
import { groupProgramsByBrand } from "@/lib/access-requests";
import type { AccessRequestProgram } from "@/src/shared/api-client";

type ProgramMultiSelectProps = {
  programs: AccessRequestProgram[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  label: string;
};

/** Checkbox list grouped by brand, with a filter box; each row is a label, so the whole row clicks. */
export function ProgramMultiSelect({ programs, value, onChange, disabled, label }: ProgramMultiSelectProps) {
  const [filter, setFilter] = React.useState("");
  const needle = filter.trim().toLowerCase();
  const groups = groupProgramsByBrand(
    needle
      ? programs.filter((p) => `${p.name} ${p.brandName}`.toLowerCase().includes(needle))
      : programs,
  );

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2" role="group" aria-label={label}>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter programs"
        aria-label={`Filter ${label.toLowerCase()}`}
        disabled={disabled}
        className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:bg-zinc-50"
      />
      <div className="max-h-56 overflow-y-auto rounded-md border border-zinc-200 bg-white">
        {groups.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-zinc-500">No programs match.</p>
        ) : (
          groups.map((group) => (
            <div key={group.brandName}>
              <p className="sticky top-0 border-b border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {group.brandName}
              </p>
              {group.programs.map((program) => (
                <label
                  key={program.id}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(program.id)}
                    onChange={() => toggle(program.id)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-zinc-300 accent-blue-600"
                  />
                  <span>{program.name}</span>
                </label>
              ))}
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-zinc-500">{value.length} selected</p>
    </div>
  );
}
