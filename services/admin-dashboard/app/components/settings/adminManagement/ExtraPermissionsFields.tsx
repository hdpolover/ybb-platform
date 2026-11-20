// services/admin-dashboard/app/components/settings/adminManagement/ExtraPermissionsFields.tsx
"use client";

import { extraPermissionCategories } from "@/lib/admin-access";

/** Per-admin extras on top of the role: role-provided keys show checked and locked, the rest are the admin's own. */
export function ExtraPermissionsFields({
  rolePermissions,
  extras,
  onChange,
  legacyPrivileged,
  disabled,
}: {
  rolePermissions: ReadonlySet<string>;
  extras: readonly string[];
  onChange: (extras: string[]) => void;
  legacyPrivileged: readonly string[];
  disabled: boolean;
}) {
  const toggle = (key: string, checked: boolean) =>
    onChange(checked ? [...extras.filter((k) => k !== key), key] : extras.filter((k) => k !== key));

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-[11px] font-medium text-zinc-700">Extra permissions</legend>
      <p className="text-[11px] text-zinc-500">Added on top of the role. They never take anything away.</p>
      {extraPermissionCategories.map((category) => (
        <div key={category.id}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{category.name}</div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            {category.permissions.map((permission) => {
              const fromRole = rolePermissions.has(permission.key);
              const id = `extra-${permission.key}`;
              return (
                <div key={permission.key} className="flex items-center gap-1.5">
                  <input
                    id={id}
                    type="checkbox"
                    checked={fromRole || extras.includes(permission.key)}
                    disabled={disabled || fromRole}
                    onChange={(e) => toggle(permission.key, e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-500"
                  />
                  <label htmlFor={id} title={permission.description} className="text-[11px] text-zinc-700">
                    {permission.label}
                  </label>
                  {fromRole && <span className="text-[10px] text-zinc-400">from role</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {legacyPrivileged.length > 0 && (
        <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600">
          <span className="font-medium">Also granted directly: </span>
          {legacyPrivileged.map((permission, i) => (
            <span key={permission}>
              {i > 0 && ", "}
              <code className="font-mono">{permission}</code>
            </span>
          ))}
          . Kept as is; change via role.
        </div>
      )}
    </fieldset>
  );
}
