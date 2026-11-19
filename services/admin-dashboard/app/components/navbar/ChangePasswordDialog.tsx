// services/admin-dashboard/app/components/navbar/ChangePasswordDialog.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import { validateChangePassword } from "@/lib/access-requests";
import { changeOwnPassword } from "@/src/shared/api-client";

export const PASSWORD_CHANGED_MESSAGE = "Password changed. Other sessions were signed out.";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(value: boolean) {
    if (pending) return;
    if (!value) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
    }
    onOpenChange(value);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const problem = validateChangePassword(current, next, confirm);
    setError(problem);
    if (problem) return;

    setPending(true);
    try {
      await changeOwnPassword(current, next);
      toast.success(PASSWORD_CHANGED_MESSAGE);
      setPending(false);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Use at least 8 characters with uppercase, lowercase, and a number or symbol. Your other sessions will be
            signed out.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="cp-current" className="mb-1 block text-sm font-medium text-zinc-700">Current password</label>
            <Input
              id="cp-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="cp-new" className="mb-1 block text-sm font-medium text-zinc-700">New password</label>
            <Input
              id="cp-new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="cp-confirm" className="mb-1 block text-sm font-medium text-zinc-700">Confirm new password</label>
            <Input
              id="cp-confirm"
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={pending}>
              {pending ? "Saving..." : "Change password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
