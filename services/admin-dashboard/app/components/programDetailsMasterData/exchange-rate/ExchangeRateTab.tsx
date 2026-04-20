"use client";

import { useState, useEffect, useCallback } from "react";
import { CurrencyDollarIcon, ClockIcon } from "@heroicons/react/24/solid";
import { buildApiUrl, getAccessToken, readErrorMessage } from "@/app/components/submissionsMasterData/api";

interface ExchangeRateData {
  programId: string;
  usdInIdr: number;
  source: "program" | "brand";
  updatedAt: string;
}

interface HistoryEntry {
  id: string;
  oldRate: number;
  newRate: number;
  changedBy: string;
  reason?: string;
  createdAt: string;
}

interface HistoryResponse {
  history: HistoryEntry[];
  total: number;
}

function formatRate(rate: number): string {
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(rate);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ExchangeRateTab({ programId }: { programId: string }) {
  const [current, setCurrent] = useState<ExchangeRateData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [rateRes, histRes] = await Promise.all([
        fetch(buildApiUrl(`/programs/${programId}/exchange-rate`), { cache: "no-store", headers }),
        fetch(buildApiUrl(`/programs/${programId}/exchange-rate/history?limit=20`), { cache: "no-store", headers }),
      ]);

      if (!rateRes.ok) throw new Error(await readErrorMessage(rateRes));
      if (!histRes.ok) throw new Error(await readErrorMessage(histRes));

      const rateEnv = await rateRes.json() as ExchangeRateData;
      const histEnv = await histRes.json() as HistoryResponse;

      setCurrent(rateEnv);
      setHistory(histEnv.history);
      setHistoryTotal(histEnv.total);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load exchange rate.");
    } finally {
      setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    const rate = parseFloat(newRate);
    if (Number.isNaN(rate) || rate <= 0) {
      setSaveError("Enter a valid positive rate.");
      return;
    }

    const token = getAccessToken();
    if (!token) { setSaveError("You must be signed in."); return; }

    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(buildApiUrl(`/programs/${programId}/exchange-rate`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ usdInIdr: rate, reason: reason.trim() || undefined }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      setIsEditing(false);
      setNewRate("");
      setReason("");
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update rate.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
        Loading exchange rate...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Rate Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <CurrencyDollarIcon className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Current Rate</p>
              <p className="mt-0.5 text-2xl font-bold text-zinc-900">
                1 USD = <span className="text-emerald-700">IDR {current ? formatRate(current.usdInIdr) : "—"}</span>
              </p>
              {current && (
                <p className="mt-1 text-xs text-zinc-500">
                  Source:{" "}
                  <span className={`font-semibold ${current.source === "program" ? "text-blue-600" : "text-amber-600"}`}>
                    {current.source === "program" ? "Program override" : "Brand default"}
                  </span>
                  {" · "}Last updated {formatDateTime(current.updatedAt)}
                </p>
              )}
            </div>
          </div>

          {!isEditing && (
            <button
              onClick={() => {
                setNewRate(current ? String(current.usdInIdr) : "");
                setReason("");
                setSaveError(null);
                setIsEditing(true);
              }}
              className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              Edit Rate
            </button>
          )}
        </div>

        {isEditing && (
          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="mb-3 text-sm font-semibold text-zinc-800">Update Exchange Rate</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  New Rate (IDR per 1 USD)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  placeholder="e.g. 16500"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Reason <span className="text-zinc-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Mid-year rate adjustment"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {saveError && (
              <p className="mt-2 text-xs text-rose-600">{saveError}</p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save Rate"}
              </button>
              <button
                onClick={() => { setIsEditing(false); setSaveError(null); }}
                disabled={isSaving}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-800">
            Rate History{historyTotal > 0 && <span className="ml-1.5 text-zinc-400">({historyTotal})</span>}
          </h3>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-zinc-400">No rate changes recorded yet.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    IDR {formatRate(entry.oldRate)}{" "}
                    <span className="text-zinc-400">→</span>{" "}
                    <span className="text-emerald-700">IDR {formatRate(entry.newRate)}</span>
                  </p>
                  {entry.reason && (
                    <p className="mt-0.5 text-xs text-zinc-500">{entry.reason}</p>
                  )}
                  <p className="mt-0.5 text-xs text-zinc-400">
                    by {entry.changedBy} · {formatDateTime(entry.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {entry.newRate > entry.oldRate ? (
                    <span className="text-xs font-semibold text-rose-600">
                      +{formatRate(entry.newRate - entry.oldRate)}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-600">
                      -{formatRate(entry.oldRate - entry.newRate)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Snapshot note */}
      <p className="text-xs text-zinc-400">
        Exchange rates are snapshotted at the time of payment. Updating this rate will not affect existing paid invoices.
      </p>
    </div>
  );
}
