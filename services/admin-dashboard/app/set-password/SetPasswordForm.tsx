// services/admin-dashboard/app/set-password/SetPasswordForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { PublicCardShell } from "@/src/admin/components/public-card-shell";
import { validateNewPassword } from "@/lib/access-requests";
import { ApiError, setPasswordWithToken } from "@/src/shared/api-client";

const INVALID_LINK_MESSAGE = "This link is invalid or expired; ask your supervisor for a new one.";

export default function SetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  if (!token || linkInvalid) {
    return (
      <PublicCardShell title="Set your password">
        <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {INVALID_LINK_MESSAGE}
        </p>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="font-medium text-blue-600 underline-offset-2 hover:underline">
            Go to sign in
          </Link>
        </p>
      </PublicCardShell>
    );
  }

  if (done) {
    return (
      <PublicCardShell title="Set your password">
        <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
          <p className="text-sm text-zinc-700">Password set. You can sign in now.</p>
          <Link href="/login" className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline">
            Go to sign in
          </Link>
        </div>
      </PublicCardShell>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !token) return;

    const problem = validateNewPassword(password, confirm);
    setError(problem);
    if (problem) return;

    setPending(true);
    try {
      await setPasswordWithToken(token, password);
      setDone(true);
    } catch (err) {
      // The API answers 400 for a bad, used or expired token; password-rule 400s are caught client-side first.
      if (err instanceof ApiError && err.status === 400) setLinkInvalid(true);
      else setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <PublicCardShell
      title="Set your password"
      subtitle="Use at least 8 characters with uppercase, lowercase, and a number or symbol."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="sp-password" className="mb-1 block text-sm font-medium text-zinc-700">New password</label>
          <Input
            id="sp-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="sp-confirm" className="mb-1 block text-sm font-medium text-zinc-700">Confirm password</label>
          <Input
            id="sp-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={pending} disabled={pending}>
          {pending ? "Saving..." : "Set password"}
        </Button>
      </form>
    </PublicCardShell>
  );
}
