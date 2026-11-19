// services/admin-dashboard/app/components/settings/adminManagement/AdminAccessFields.tsx
"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Select } from "@/src/ui/select";
import { ProgramMultiSelect } from "@/src/admin/components/program-multi-select";
import { isPlatformTierRole } from "@/lib/access-requests";
import type { AccessRequestProgram, AdminRole } from "@/src/shared/api-client";

export const PLATFORM_ROLE_WARNING = "This role can see every brand and/or manage admins.";

export function participantAccountWarning(brands: string[], verb = "Approving"): string {
  return `This email already has a participant account (${brands.join(", ")}). ${verb} may turn that account into the admin account and reset its password; they'll set a new one from the invite email.`;
}

/** Amber heads-up used by both the approve and invite dialogs. */
export function AmberNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/** Role select (with the platform-tier warning) and the programs picker: the part approve and invite share. */
export function RoleAndProgramsFields({
  idPrefix,
  roles,
  roleId,
  onRoleChange,
  programs,
  programIds,
  onProgramIdsChange,
  disabled,
}: {
  idPrefix: string;
  roles: AdminRole[];
  roleId: string;
  onRoleChange: (roleId: string) => void;
  programs: AccessRequestProgram[];
  programIds: string[];
  onProgramIdsChange: (programIds: string[]) => void;
  disabled: boolean;
}) {
  const selectedRole = roles.find((role) => role.id === roleId);
  const showPlatformWarning = selectedRole ? isPlatformTierRole(selectedRole) : false;

  return (
    <>
      <Select
        id={`${idPrefix}-role`}
        label="Role"
        value={roleId}
        onChange={(e) => onRoleChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select a role</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </Select>

      {showPlatformWarning ? <AmberNotice>{PLATFORM_ROLE_WARNING}</AmberNotice> : null}

      <div>
        <span className="mb-1 block text-sm font-medium text-zinc-700">Programs</span>
        <ProgramMultiSelect
          label="Programs"
          programs={programs}
          value={programIds}
          onChange={onProgramIdsChange}
          disabled={disabled}
        />
      </div>
    </>
  );
}
