// services/api/src/shared/admin-extra-permissions.ts
import { BadRequestException } from '@nestjs/common';
import { normalizePermissions } from './admin-access-response';

/**
 * Permissions that make an admin platform tier or let them manage admins/roles.
 * They can come only from a role, never from a per-admin "extra permissions"
 * edit. Anything ending in `*` is privileged too (admin.*, platform.*, roles.*).
 *
 * Mirrored by hand in services/admin-dashboard/lib/admin-access.ts
 * (PRIVILEGED_PERMISSIONS): keep the two in step.
 */
export const PRIVILEGED_PERMISSIONS = [
  '*',
  'platform_access',
  'platform.manage',
  'brand.manage',
  'admin.manage',
  'roles.manage',
] as const;

/**
 * The only keys a per-admin extra may carry: the non-privileged keys the role
 * editor offers (admin-dashboard lib/admin-access.ts permissionCategories).
 * The API has no other catalog of valid keys.
 */
export const EXTRA_PERMISSION_KEYS: readonly string[] = [
  'program:read',
  'program:write',
  'applications:read',
  'applications:write',
  'review:read',
  'review:write',
  'participants:read',
  'participants:write',
  'support:read',
  'support:write',
  'support:impersonate',
  'content:read',
  'content:write',
  'announcements:read',
  'announcements:write',
  'media:read',
  'media:write',
  'documents:read',
  'documents:write',
  'partnerships:read',
  'partnerships:write',
  'payments:read',
  'payments:write',
];

const clean = (permission: string) => permission.trim().toLowerCase();

export function isPrivilegedPermission(permission: string): boolean {
  const value = clean(permission);
  return value.endsWith('*') || (PRIVILEGED_PERMISSIONS as readonly string[]).includes(value);
}

/** Validates submitted extras: trimmed, lowercased, deduped, sorted. Throws 400 on anything else. */
export function normalizeExtraPermissions(input: unknown): string[] {
  if (!Array.isArray(input) || input.some((value) => typeof value !== 'string')) {
    throw new BadRequestException('customPermissions must be an array of permission keys.');
  }
  const values = Array.from(new Set((input as string[]).map(clean))).sort();
  const privileged = values.filter(isPrivilegedPermission);
  if (privileged.length > 0) {
    throw new BadRequestException(`These permissions can only come from a role: ${privileged.join(', ')}.`);
  }
  const unknown = values.filter((value) => !EXTRA_PERMISSION_KEYS.includes(value));
  if (unknown.length > 0) {
    throw new BadRequestException(`Unknown permissions: ${unknown.join(', ')}.`);
  }
  return values;
}

/** Stored non-privileged entries, normalised: what the extras editor shows and compares. */
export function storedExtraPermissions(stored: unknown): string[] {
  return Array.from(new Set(normalizePermissions(stored).map(clean).filter((v) => !isPrivilegedPermission(v)))).sort();
}

/**
 * Value to store after an extras edit: the stored privileged entries kept as
 * they are (legacy rows such as a super admin's "*"), plus the validated extras.
 * Submitted extras can neither add nor remove a privileged entry.
 */
export function mergeCustomPermissions(stored: unknown, extras: string[]): string[] {
  const seen = new Set<string>();
  const privileged = normalizePermissions(stored).filter((permission) => {
    const key = clean(permission);
    if (!isPrivilegedPermission(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...privileged, ...extras.filter((permission) => !isPrivilegedPermission(permission))];
}
