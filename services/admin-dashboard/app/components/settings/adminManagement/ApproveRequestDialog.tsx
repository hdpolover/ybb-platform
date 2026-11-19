// services/admin-dashboard/app/components/settings/adminManagement/ApproveRequestDialog.tsx
"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import { Button } from "@/src/ui/button";
import { Select } from "@/src/ui/select";
import { ProgramMultiSelect } from "@/src/admin/components/program-multi-select";
import { isPlatformTierRole } from "@/lib/access-requests";
import {
  approveAccessRequest,
  type AccessRequest,
  type AccessRequestProgram,
  type AdminRole,
} from "@/src/shared/api-client";

export const APPROVE_EMAIL_FAILED_MESSAGE =
  "Approved, but the invite email failed. Use Send password link on their row.";

export function participantAccountWarning(brands: string[]): string {
  return `This email already has a participant account (${brands.join(", ")}). Approving may turn that account into the admin account and reset its password; they'll set a new one from the invite email.`;
}

export const PLATFORM_ROLE_WARNING = "This role can see every brand and/or manage admins.";

export function ApproveRequestDialog({
  request,
  roles,
  programs,
  onClose,
  onApproved,
}: {
  request: AccessRequest;
  roles: AdminRole[];
  /** Programs the approver may assign; requested programs are merged in so they always show. */
  programs: AccessRequestProgram[];
  onClose: () => void;
  onApproved: () => void;
}) {
  const [roleId, setRoleId] = useState(request.defaultRoleId ?? "");
  const [programIds, setProgramIds] = useState(request.requestedPrograms.map((p) => p.id));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const programOptions = useMemo(() => {
    const byId = new Map(programs.map((p) => [p.id, p]));
    for (const requested of request.requestedPrograms) byId.set(requested.id, requested);
    return [...byId.values()];
  }, [programs, request.requestedPrograms]);

  const selectedRole = roles.find((role) => role.id === roleId);
  const showPlatformWarning = selectedRole ? isPlatformTierRole(selectedRole) : false;

  async function handleApprove() {
    setPending(true);
    setError(null);
    try {
      const result = await approveAccessRequest(request.id, { roleId, programIds });
      if (result.emailSent === false) toast.warning(APPROVE_EMAIL_FAILED_MESSAGE);
      else toast.success("Approved. Invite email sent.");
      onApproved();
      onClose();
    } catch (err) {
      // A 409 means the email is already an admin; the API message says so.
      setError(err instanceof Error ? err.message : "Failed to approve the request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve {request.fullName}</DialogTitle>
          <DialogDescription>
            {request.email} · {request.divisionLabel}. Confirm the role and programs; an email with a
            set-password link is sent on approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {request.participantBrands.length > 0 ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {participantAccountWarning(request.participantBrands)}
            </p>
          ) : null}

          <Select
            id="approve-role"
            label="Role"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            disabled={pending}
          >
            <option value="">Select a role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>

          {showPlatformWarning ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {PLATFORM_ROLE_WARNING}
            </p>
          ) : null}

          <div>
            <span className="mb-1 block text-sm font-medium text-zinc-700">Programs</span>
            <ProgramMultiSelect
              label="Programs"
              programs={programOptions}
              value={programIds}
              onChange={setProgramIds}
              disabled={pending}
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleApprove()} loading={pending} disabled={!roleId}>
            Approve and send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
