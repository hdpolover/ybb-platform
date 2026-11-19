// services/admin-dashboard/app/forgot-password/ForgotPasswordForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { PublicCardShell } from "@/src/admin/components/public-card-shell";
import { isValidEmail } from "@/lib/access-requests";
import { ApiError, getTurnstileSiteKey, requestAdminPasswordReset } from "@/src/shared/api-client";
import TurnstileWidget, { type TurnstileWidgetHandle } from "../request-access/TurnstileWidget";

const CHALLENGE_FAILED_MESSAGE = "We couldn't verify you're human. Reload the page and try again.";
// Same words whether or not the address is an admin: the page must not become an account oracle.
export const SENT_MESSAGE = "If that email belongs to an admin, a reset link is on its way.";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await requestAdminPasswordReset(email.trim(), token);
      setSent(true);
    } catch (err) {
      // Tokens are single-use: any failure burns this one, so get a fresh challenge.
      setToken(null);
      widget.current?.reset();
      if (err instanceof ApiError && err.status === 403) setError(CHALLENGE_FAILED_MESSAGE);
      else if (err instanceof ApiError && err.status === 429) setError("Too many requests. Try again in a little while.");
      else setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <PublicCardShell title="Forgot password">
        <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
          <p className="text-sm text-zinc-700">{SENT_MESSAGE}</p>
          <p className="text-xs text-zinc-500">The link works once and expires in 1 hour.</p>
          <Link href="/login" className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </div>
      </PublicCardShell>
    );
  }

  return (
    <PublicCardShell title="Forgot password" subtitle="Enter your admin email and we'll send you a link to set a new password.">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="fp-email" className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
          <Input
            id="fp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
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

        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" loading={pending} disabled={pending || (!token && !challengeUnavailable)}>
          {pending ? "Sending..." : "Send reset link"}
        </Button>

        <p className="text-center text-xs text-zinc-500">
          <Link href="/login" className="font-medium text-blue-600 underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </PublicCardShell>
  );
}
