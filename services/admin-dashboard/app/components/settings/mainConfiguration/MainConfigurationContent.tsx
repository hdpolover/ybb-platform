"use client";

import {
  BoltIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
  PowerIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import type { ExchangeRateHistoryItem } from "@/src/shared/api-client";

export type EmailVerificationMode = "Optional" | "Required";

export type MainConfigurationContentProps = {
  registrationOpen: boolean;
  onToggleRegistration: () => void;
  emailVerification: EmailVerificationMode;
  onToggleEmailVerification: () => void;
  programActive: boolean;
  onToggleProgramActive: () => void;
  usdToIdrRate: number;
  onChangeUsdToIdrRate: (value: number) => void;
  exchangeRateReason: string;
  onChangeExchangeRateReason: (value: string) => void;
  rateHistory: ExchangeRateHistoryItem[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
};

export function MainConfigurationContent({
  registrationOpen,
  onToggleRegistration,
  emailVerification,
  onToggleEmailVerification,
  programActive,
  onToggleProgramActive,
  usdToIdrRate,
  onChangeUsdToIdrRate,
  exchangeRateReason,
  onChangeExchangeRateReason,
  rateHistory,
  saving,
  onSave,
  onCancel,
}: MainConfigurationContentProps) {
  return (
    <section className="space-y-3">
      <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm md:px-5 md:py-4 md:text-base">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">
              Main Configuration Settings
            </h2>
            <p className="text-xs text-zinc-500 md:text-sm">
              Control core system behaviour, registration flow, and financial defaults for this
              program.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-3 md:px-4">
            <div className="mb-1 flex items-center gap-2">
              <BoltIcon className="h-4 w-4 text-amber-500 md:h-5 md:w-5" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 md:text-[13px]">
                System Status Settings
              </h3>
            </div>

            <div className="space-y-3 text-xs md:text-sm">
              <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-900 md:text-sm">
                    <UserGroupIcon className="h-4 w-4 text-blue-500" />
                    <span>Registration Open</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 md:text-xs">
                    When enabled, users can register for the program.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleRegistration}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full border text-[11px] shadow-sm transition-colors ${
                      registrationOpen
                        ? "border-emerald-400 bg-emerald-400"
                        : "border-zinc-300 bg-zinc-200"
                    }`}
                    aria-label="Toggle registration open"
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        registrationOpen ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      registrationOpen
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                    }`}
                  >
                    {registrationOpen ? "Open" : "Closed"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-900 md:text-sm">
                    <EnvelopeIcon className="h-4 w-4 text-emerald-500" />
                    <span>Email Verification Required</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 md:text-xs">
                    When enabled, users must verify their email before accessing the system.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleEmailVerification}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full border text-[11px] shadow-sm transition-colors ${
                      emailVerification === "Required"
                        ? "border-emerald-400 bg-emerald-400"
                        : "border-zinc-300 bg-zinc-200"
                    }`}
                    aria-label="Toggle email verification requirement"
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        emailVerification === "Required" ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      emailVerification === "Required"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                    }`}
                  >
                    {emailVerification === "Required" ? "Required" : "Optional"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-900 md:text-sm">
                    <PowerIcon className="h-4 w-4 text-emerald-500" />
                    <span>Program Active Status</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 md:text-xs">
                    When enabled, the program is active and operational.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleProgramActive}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full border text-[11px] shadow-sm transition-colors ${
                      programActive
                        ? "border-emerald-400 bg-emerald-400"
                        : "border-zinc-300 bg-zinc-200"
                    }`}
                    aria-label="Toggle program active status"
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        programActive ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      programActive
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                    }`}
                  >
                    {programActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-3 md:px-4">
            <div className="mb-1 flex items-center gap-2">
              <CurrencyDollarIcon className="h-4 w-4 text-emerald-500 md:h-5 md:w-5" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 md:text-[13px]">
                Financial Defaults
              </h3>
            </div>

            <div className="space-y-3 text-xs md:text-sm">
              <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-900 md:text-sm">
                    <span>USD to IDR Rate</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500">1 USD =</span>
                  <input
                    type="number"
                    min={0}
                    value={usdToIdrRate}
                    onChange={(event) => onChangeUsdToIdrRate(Number(event.target.value) || 0)}
                    className="w-28 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-right text-[11px] text-zinc-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 md:w-32 md:text-xs"
                  />
                  <span className="text-[11px] font-medium text-zinc-700">IDR</span>
                </div>
              </div>

              <div className="rounded-md bg-white px-3 py-2.5">
                <label className="mb-1 block text-[11px] font-medium text-zinc-700 md:text-xs">
                  Reason for rate change <span className="font-normal text-zinc-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={exchangeRateReason}
                  onChange={(e) => onChangeExchangeRateReason(e.target.value)}
                  placeholder="e.g. Bank Indonesia rate update April 2026"
                  className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 md:text-xs"
                />
              </div>

              {rateHistory.length > 0 && (
                <div className="rounded-md bg-white px-3 py-2.5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 md:text-xs">
                    Rate Change History
                  </p>
                  <div className="divide-y divide-zinc-100">
                    {rateHistory.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-2 py-1.5">
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-zinc-900 md:text-xs">
                            <span className="font-medium text-red-500">
                              {Number(item.oldRate).toLocaleString()}
                            </span>
                            {" → "}
                            <span className="font-medium text-emerald-600">
                              {Number(item.newRate).toLocaleString()}
                            </span>
                            {" IDR"}
                          </p>
                          {item.reason && (
                            <p className="text-[10px] italic text-zinc-500">{item.reason}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] text-zinc-400">
                          {new Date(item.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 disabled:opacity-60 md:text-sm"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60 md:text-sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </section>
  );
}
