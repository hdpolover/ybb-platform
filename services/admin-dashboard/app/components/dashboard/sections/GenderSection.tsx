"use client";

import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface GenderDatum {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface GenderSectionProps {
  data: GenderDatum[];
  colors: string[];
  onOpenDetails: () => void;
}

export function GenderSection({ data, colors, onOpenDetails }: GenderSectionProps) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Gender Distribution
            </div>
            <p className="text-[11px] text-zinc-500">
              Komposisi peserta berdasarkan gender.
            </p>
          </div>
          <button
            type="button"
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
            onClick={onOpenDetails}
          >
            View all
          </button>
        </div>

        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={(props: { value: number }) => {
                  const total = data.reduce((sum, g) => sum + g.value, 0);
                  const percent = total ? ((props.value as number) / total) * 100 : 0;

                  if (percent < 5) return null;

                  return `${percent.toFixed(1)}%`;
                }}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-[11px] text-zinc-600">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
  );
}
