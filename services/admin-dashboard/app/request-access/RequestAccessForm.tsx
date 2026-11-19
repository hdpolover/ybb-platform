// services/admin-dashboard/app/request-access/RequestAccessForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Select } from "@/src/ui/select";
import { PublicCardShell } from "@/src/admin/components/public-card-shell";
import { ProgramMultiSelect } from "@/src/admin/components/program-multi-select";
import { NAME_MAX, NOTE_MAX, validateAccessRequest } from "@/lib/access-requests";
import {
  ApiError,
  getAccessRequestOptions,
  getTurnstileSiteKey,
  submitAccessRequest,
  type AccessRequestOptions,
} from "@/src/shared/api-client";
import TurnstileWidget, { type TurnstileWidgetHandle } from "./TurnstileWidget";

const CHALLENGE_FAILED_MESSAGE = "We couldn't verify you're human. Reload the page and try again.";
const SUCCESS_MESSAGE = "Request sent. You'll get an email once a supervisor approves it.";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-xs text-red-600">
      {message}
    </p>
  ) : null;
}

export default function RequestAccessForm() {
  const [options, setOptions] = useState<AccessRequestOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [division, setDivision] = useState("");
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  // undefined = still fetching the key; null = none available (widget can't run).
  const [siteKey, setSiteKey] = useState<string | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [widgetFailed, setWidgetFailed] = useState(false);
  const widget = useRef<TurnstileWidgetHandle>(null);
  // Without a widget the API decides (it refuses and we show the error), so don't trap the user.
  const challengeUnavailable = siteKey === null || widgetFailed;

  useEffect(() => {
    let active = true;
    getTurnstileSiteKey()
      .then((key) => active && setSiteKey(key))
      .catch(() => active && setSiteKey(null));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getAccessRequestOptions()
      .then((result) => active && setOptions(result))
      .catch(() => active && setOptionsError("Could not load the form options. Refresh the page to try again."));
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const found = validateAccessRequest({ fullName, email, division, programIds, note });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    setSubmitError(null);
    try {
      await submitAccessRequest(
        {
          fullName: fullName.trim(),
          email: email.trim(),
          ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
          division,
          programIds,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        token,
      );
      setSent(true);
    } catch (error) {
      // Tokens are single-use: any failure burns this one, so get a fresh challenge.
      setToken(null);
      widget.current?.reset();
      if (error instanceof ApiError && error.status === 403) setSubmitError(CHALLENGE_FAILED_MESSAGE);
      else setSubmitError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <PublicCardShell title="Request access">
        <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
          <p className="text-sm text-zinc-700">{SUCCESS_MESSAGE}</p>
          <Link href="/login" className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </div>
      </PublicCardShell>
    );
  }

  return (
    <PublicCardShell
      title="Request access"
      subtitle="Tell us who you are and what you work on. A supervisor reviews every request."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="ra-name" className="mb-1 block text-sm font-medium text-zinc-700">Full name</label>
          <Input
            id="ra-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={NAME_MAX}
            autoComplete="name"
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? "ra-name-err" : undefined}
          />
          <FieldError id="ra-name-err" message={errors.fullName} />
        </div>

        <div>
          <label htmlFor="ra-email" className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
          <Input
            id="ra-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "ra-email-err" : undefined}
          />
          <FieldError id="ra-email-err" message={errors.email} />
        </div>

        <div>
          <label htmlFor="ra-whatsapp" className="mb-1 block text-sm font-medium text-zinc-700">
            WhatsApp <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <Input
            id="ra-whatsapp"
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            autoComplete="tel"
          />
        </div>

        <div>
          <Select
            id="ra-division"
            label="Division"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            disabled={!options}
            aria-invalid={Boolean(errors.division)}
          >
            <option value="">{options ? "Select your division" : "Loading..."}</option>
            {options?.divisions.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </Select>
          <FieldError id="ra-division-err" message={errors.division} />
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-zinc-700">
            Programs <span className="font-normal text-zinc-400">(optional)</span>
          </span>
          {options ? (
            <ProgramMultiSelect
              label="Programs"
              programs={options.programs}
              value={programIds}
              onChange={setProgramIds}
              disabled={pending}
            />
          ) : (
            <p className="text-xs text-zinc-500">{optionsError ?? "Loading programs..."}</p>
          )}
          <FieldError id="ra-programs-err" message={errors.programIds} />
        </div>

        <div>
          <label htmlFor="ra-note" className="mb-1 block text-sm font-medium text-zinc-700">
            Note <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="ra-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            placeholder="Anything your supervisor should know"
            aria-invalid={Boolean(errors.note)}
          />
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-red-600">{errors.note}</span>
            <span className={note.length > NOTE_MAX ? "text-red-600" : "text-zinc-400"}>
              {note.length}/{NOTE_MAX}
            </span>
          </div>
        </div>

        {siteKey ? (
          <TurnstileWidget
            ref={widget}
            siteKey={siteKey}
            onToken={(value) => {
              setToken(value);
              setWidgetFailed(false);
            }}
            onExpire={() => setToken(null)}
            onError={() => {
              setToken(null);
              setWidgetFailed(true);
            }}
          />
        ) : null}

        {submitError ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {submitError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" loading={pending} disabled={pending || !options || (!token && !challengeUnavailable)}>
          {pending ? "Sending..." : "Send request"}
        </Button>

        <p className="text-center text-xs text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-blue-600 underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </PublicCardShell>
  );
}
