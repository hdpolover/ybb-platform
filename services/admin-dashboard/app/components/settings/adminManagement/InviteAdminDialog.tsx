// services/admin-dashboard/app/components/settings/adminManagement/InviteAdminDialog.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { EnglishInput } from "@/src/ui/english-input";
import { NAME_MAX, NAME_MIN, isValidEmail } from "@/lib/access-requests";
import {
  checkAdminInvite,
  inviteAdmin,
  type AccessRequestProgram,
  type AdminRole,
  type InviteCheckResult,
} from "@/src/shared/api-client";
import { AmberNotice, RoleAndProgramsFields, participantAccountWarning } from "./AdminAccessFields";

export const INVITE_EMAIL_FAILED_MESSAGE =
  "Admin created, but the invite email failed. Use Send password link on their row.";
export const ALREADY_ADMIN_MESSAGE =
  'This email already belongs to an admin. Use "Send password link" on their row instead.';

const CHECK_DEBOUNCE_MS = 300;

export function InviteAdminDialog({
  roles,
  programs,
  initialProgramIds = [],
  onClose,
  onInvited,
}: {
  roles: AdminRole[];
  programs: AccessRequestProgram[];
  /** Programs ticked when the dialog opens (e.g. the program whose settings page it was opened from). */
  initialProgramIds?: string[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [programIds, setProgramIds] = useState<string[]>(initialProgramIds);
  const [check, setCheck] = useState<InviteCheckResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
  }, []);

  const normalizedEmail = email.trim().toLowerCase();

  function handleEmailChange(value: string) {
    setEmail(value);
    // The warnings belong to the address that was checked; drop them as soon as it changes.
    setCheck(null);
    if (checkTimer.current) clearTimeout(checkTimer.current);
  }

  function handleEmailBlur() {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!isValidEmail(normalizedEmail)) return;
    checkTimer.current = setTimeout(() => {
      checkAdminInvite(normalizedEmail)
        .then((result) => setCheck(result))
        // A hint only: the invite call itself still answers 409 for an existing admin.
        .catch(() => setCheck(null));
    }, CHECK_DEBOUNCE_MS);
  }

  const nameLength = fullName.trim().length;
  const canSubmit =
    nameLength >= NAME_MIN &&
    nameLength <= NAME_MAX &&
    isValidEmail(normalizedEmail) &&
    roleId !== "" &&
    !check?.existingAdminId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const result = await inviteAdmin({ fullName: fullName.trim(), email: normalizedEmail, roleId, programIds });
      if (result.emailSent === false) toast.warning(INVITE_EMAIL_FAILED_MESSAGE);
      else toast.success(`Invite sent to ${normalizedEmail}`);
      onInvited();
      onClose();
    } catch (err) {
      // A 409 means the email is already an admin (or its participant account is deactivated); the API message says which.
      setError(err instanceof Error ? err.message : "Failed to send the invite.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite administrator</DialogTitle>
          <DialogDescription>
            They get an email with a single-use link (valid 72 hours) to set their own password.
          </DialogDescription>
        </DialogHeader>

        <form id="invite-admin-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="invite-name" className="mb-1 block text-sm font-medium text-zinc-700">
              Full name
            </label>
            <EnglishInput
              id="invite-name"
              required
              type="text"
              restrictMode="name"
              maxLength={NAME_MAX}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={pending}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-zinc-700">
              Email
            </label>
            <Input
              id="invite-email"
              required
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              disabled={pending}
            />
          </div>

          {check?.existingAdminId ? <AmberNotice>{ALREADY_ADMIN_MESSAGE}</AmberNotice> : null}
          {check && !check.existingAdminId && check.participantBrands.length > 0 ? (
            <AmberNotice>{participantAccountWarning(check.participantBrands, "Inviting")}</AmberNotice>
          ) : null}

          <RoleAndProgramsFields
            idPrefix="invite"
            roles={roles}
            roleId={roleId}
            onRoleChange={setRoleId}
            programs={programs}
            programIds={programIds}
            onProgramIdsChange={setProgramIds}
            disabled={pending}
          />

          {error ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="invite-admin-form" loading={pending} disabled={!canSubmit}>
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
