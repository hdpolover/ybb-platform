// services/admin-dashboard/app/flags.ts

/**
 * Feature flags for the admin dashboard.
 *
 * All flags read from `NEXT_PUBLIC_*` env vars at build time. To toggle
 * at runtime, the flag strategy must change (e.g. role-based gating or
 * a config endpoint). For now we rely on redeploying with a new env value.
 */

function readBoolFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return raw === "true" || raw === "1";
}

export const FLAGS = {
  /**
   * Gates the Form Field Catalog V2 UX:
   * - Catalog picker dialog on "Add Field"
   * - "Copy from template" button
   * - Default-template prompt on new-program creation
   *
   * When false, admins use the refactored editor directly (hidden key +
   * auto-slug are still on, because those are non-gated improvements).
   */
  FORM_FIELD_CATALOG_V2: readBoolFlag("NEXT_PUBLIC_FF_FORM_FIELD_CATALOG_V2"),
} as const;
