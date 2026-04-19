"use client";

import { useCallback, useEffect, useState } from "react";
import { LightBulbIcon } from "@heroicons/react/24/solid";
import {
  buildApiUrl,
  readErrorMessage,
  readJsonData,
} from "@/app/components/submissionsMasterData/api";
import { AddSubThemeAction, EditSubThemeAction, DeleteSubThemeAction } from "./SubThemeActions";

export interface SubThemeRow {
  id: string;
  programId: string;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
}

type ApiSubtheme = {
  id: string;
  programId: string;
  name: string;
  description?: string | null;
  order: number;
  isActive: boolean;
};

export function SubThemesTable({ programId }: { programId: string }) {
  const [rows, setRows] = useState<SubThemeRow[]>([]);
  const [status, setStatus] = useState<"loading" | "idle">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSubthemes = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const response = await fetch(
        buildApiUrl(`/programs/${encodeURIComponent(programId)}/subthemes?includeInactive=true`),
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const payload = await readJsonData<ApiSubtheme[]>(response);
      setRows(
        payload
          .map((item) => ({
            id: item.id,
            programId: item.programId,
            name: item.name,
            description: item.description ?? null,
            order: item.order,
            isActive: item.isActive,
          }))
          .sort((a, b) => a.order - b.order),
      );
      setStatus("idle");
    } catch (err) {
      setRows([]);
      setStatus("idle");
      setErrorMessage(err instanceof Error ? err.message : "Failed to load sub themes.");
    }
  }, [programId]);

  useEffect(() => {
    void loadSubthemes();
  }, [loadSubthemes]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <LightBulbIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Sub Themes</h2>
            <p className="text-sm text-zinc-500">Manage the sub themes used in the submission form.</p>
          </div>
        </div>
        <AddSubThemeAction programId={programId} onChanged={loadSubthemes} />
      </div>

      {errorMessage && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {errorMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
                <th className="w-12 px-6 py-4 font-semibold">No</th>
                <th className="px-6 py-4 font-semibold">Sub Theme</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {status === "loading" ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-400">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                    No sub themes configured yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                    <td className="px-6 py-4 align-top font-semibold text-zinc-900">{row.name}</td>
                    <td className="px-6 py-4 align-top text-zinc-600">{row.description ?? "—"}</td>
                    <td className="px-6 py-4 align-top">
                      <span
                        className={`inline-flex rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                          row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-600"
                        }`}
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <EditSubThemeAction subTheme={row} onChanged={loadSubthemes} />
                        <DeleteSubThemeAction subTheme={row} onChanged={loadSubthemes} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
