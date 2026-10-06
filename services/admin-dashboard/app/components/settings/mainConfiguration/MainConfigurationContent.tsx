"use client";

import {
  BoltIcon,
  EnvelopeIcon,
  PowerIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";

export type EmailVerificationMode = "Optional" | "Required";

export type MainConfigurationContentProps = {
  registrationOpen: boolean;
  onToggleRegistration: () => void;
  emailVerification: EmailVerificationMode;
  onToggleEmailVerification: () => void;
  programActive: boolean;
  onToggleProgramActive: () => void;
  saving: boolean;
  /** True when a switch differs from what the server last confirmed. */
  isDirty: boolean;
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
  saving,
  isDirty,
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

        <div className="space-y-3">
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
                    <span>Accept registrations</span>
                  </div>
                  <p id="registration-switch-hint" className="text-[11px] text-zinc-500 md:text-xs">
                    Master switch. When off, nobody can register and the landing countdown is
                    hidden, whatever the registration dates say.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={registrationOpen}
                    aria-describedby="registration-switch-hint"
                    onClick={onToggleRegistration}
                    className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full border text-[11px] shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                      registrationOpen
                        ? "border-emerald-400 bg-emerald-400"
                        : "border-zinc-300 bg-zinc-200"
                    }`}
                    aria-label="Accept registrations"
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
                    {registrationOpen ? "On" : "Off"}
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
                    role="switch"
                    aria-checked={emailVerification === "Required"}
                    onClick={onToggleEmailVerification}
                    className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full border text-[11px] shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
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
                    role="switch"
                    aria-checked={programActive}
                    onClick={onToggleProgramActive}
                    className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full border text-[11px] shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
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
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
          <p role="status" className="mr-auto pl-3 text-xs font-medium text-amber-700 md:text-sm">
            {isDirty ? "Unsaved changes. Nothing applies until you click Save Changes." : ""}
          </p>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || !isDirty}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 disabled:opacity-60 md:text-sm"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !isDirty}
            className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60 md:text-sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </section>
  );
}
