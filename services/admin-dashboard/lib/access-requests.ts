// services/admin-dashboard/lib/access-requests.ts
import { computeAccessConfig, type AdminAccessConfig, type AdminProfile } from "@/app/contexts/AuthContext";
import type { AccessRequestProgram } from "@/src/shared/api-client";

export const NAME_MIN = 2;
export const NAME_MAX = 100;
export const NOTE_MAX = 1000;
export const MAX_PROGRAMS = 30;
export const PASSWORD_MIN = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mirrors ResetPasswordDto in services/api (auth/presentation/dto/reset-password.dto.ts).
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[\d\W]).+$/;

export const isValidEmail = (email: string): boolean => EMAIL_PATTERN.test(email.trim());

export type AccessRequestDraft = {
  fullName: string;
  email: string;
  division: string;
  programIds: string[];
  note: string;
};

export function validateAccessRequest(draft: AccessRequestDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = draft.fullName.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    errors.fullName = `Name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  }
  if (!EMAIL_PATTERN.test(draft.email.trim())) errors.email = "Enter a valid email address.";
  if (!draft.division) errors.division = "Select your division.";
  if (draft.programIds.length > MAX_PROGRAMS) {
    errors.programIds = `Select at most ${MAX_PROGRAMS} programs.`;
  }
  if (draft.note.length > NOTE_MAX) errors.note = `Note must be ${NOTE_MAX} characters or fewer.`;
  return errors;
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (!PASSWORD_PATTERN.test(password)) {
    return "Password must contain uppercase, lowercase, and a number or special character.";
  }
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

export function groupProgramsByBrand(
  programs: AccessRequestProgram[],
): Array<{ brandName: string; programs: AccessRequestProgram[] }> {
  const groups = new Map<string, AccessRequestProgram[]>();
  for (const program of programs) {
    groups.set(program.brandName, [...(groups.get(program.brandName) ?? []), program]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([brandName, items]) => ({
      brandName,
      programs: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/** Roles that see every brand and/or manage admins, judged by the same rule the dashboard applies to a signed-in admin. */
export function isPlatformTierRole(role: { name: string; permissions: string[] }): boolean {
  const config = computeAccessConfig({
    accessLevel: 0,
    canManageAdmins: false,
    canAssignRoles: false,
    roleName: role.name,
    permissions: role.permissions,
    customPermissions: [],
    assignedPrograms: [],
    accessiblePrograms: [],
    assignedBrands: [],
  } as unknown as AdminProfile);
  return config.canAccessPlatform || config.canManageAdmins;
}

/**
 * Send-password-link follows the existing edit/deactivate gate (canManageAdmins), minus your own row
 * (it would log you out) and minus inactive admins (the API answers 409: the link would be dead).
 */
export function canSendPasswordLink(
  accessConfig: Pick<AdminAccessConfig, "canManageAdmins">,
  actorAdminId: string | undefined,
  targetAdminId: string,
  targetIsActive = true,
): boolean {
  return accessConfig.canManageAdmins && actorAdminId !== targetAdminId && targetIsActive;
}
