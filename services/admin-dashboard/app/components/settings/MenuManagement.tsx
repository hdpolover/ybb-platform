"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircleIcon,
  LockClosedIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/solid";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { useAuth } from "@/app/contexts/AuthContext";
import { listAdminRoles, type AdminRole as ApiAdminRole } from "@/src/shared/api-client";
import {
  buildPermissionSet,
  flattenProgramNavSections,
  hasRequiredPermissions,
} from "@/lib/admin-access";
import { programNavSections } from "@/lib/nav-config";

export type MenuItemStatus = "Active" | "Inactive";

export type MenuItemRow = {
  id: string;
  sortOrder: number;
  label: string;
  url: string;
  requiredPermission: string;
  status: MenuItemStatus;
};

export type MenuManagementProps = {
  programId: string;
  programName: string;
};

type MenuDetail = {
  id: string;
  label: string;
  path: string;
  depth: number;
  requiredPermissions: string[];
};

export function MenuManagement({ programId, programName }: MenuManagementProps) {
  const { adminProfile, accessConfig } = useAuth();
  const [roles, setRoles] = useState<ApiAdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuDetail | null>(null);

  const canManageMenuAccess = accessConfig.canManageAdmins || accessConfig.canAssignRoles;
  const currentPermissionSet = useMemo(() => buildPermissionSet(adminProfile, programId), [adminProfile, programId]);
  const menuItems = useMemo(() => flattenProgramNavSections(programNavSections), []);

  const loadRoles = useCallback(async () => {
    if (!canManageMenuAccess) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setRoles(await listAdminRoles({ programId }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load roles.");
    } finally {
      setLoading(false);
    }
  }, [canManageMenuAccess, programId]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const rows = useMemo<MenuItemRow[]>(() => {
    return menuItems.map((item, index) => ({
      id: item.id,
      sortOrder: index + 1,
      label: `${"— ".repeat(item.depth)}${item.label}`,
      url: item.href === "" ? `/programs/${programId}` : `/programs/${programId}/${item.href}`,
      requiredPermission: item.requiredPermissions.join(", "),
      status: hasRequiredPermissions(currentPermissionSet, item.requiredPermissions) ? "Active" : "Inactive",
    }));
  }, [currentPermissionSet, menuItems, programId]);

  const activeItems = rows.filter((item) => item.status === "Active").length;
  const protectedItems = rows.filter((item) => item.requiredPermission.length > 0).length;
  const permissions = new Set(
    rows.flatMap((item) =>
      item.requiredPermission
        .split(",")
        .map((permission) => permission.trim())
        .filter(Boolean),
    ),
  ).size;

  if (!canManageMenuAccess) {
    return (
      <section className="rounded-md border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-600 shadow-sm">
        This program role cannot review or manage menu access.
      </section>
    );
  }

  return (
    <main className="space-y-4 text-sm md:text-base">
      <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm md:px-5 md:py-4 md:text-base">
        <div className="mb-3 space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
            <span>Settings</span>
          </div>
          <h1 className="text-base font-semibold text-zinc-900 md:text-lg">Menu Management</h1>
          <p className="text-xs text-zinc-500 md:text-sm">
            Navigation is now permission-driven. Edit roles to change access; this page shows the live rules for {programName}.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCard label="Menu Items" value={rows.length} icon={<Squares2X2Icon className="h-5 w-5 text-blue-600" />} tone="blue" />
          <SummaryCard label="Visible to You" value={activeItems} icon={<CheckCircleIcon className="h-5 w-5 text-emerald-600" />} tone="emerald" />
          <SummaryCard label="Protected Items" value={protectedItems} icon={<LockClosedIcon className="h-5 w-5 text-amber-600" />} tone="amber" />
          <SummaryCard label="Permission Keys" value={permissions} icon={<LockClosedIcon className="h-5 w-5 text-purple-600" />} tone="purple" />
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:px-5 md:py-4 md:text-sm">
        <div className="mb-3 space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program navigation rules</h2>
          <p className="text-[11px] text-zinc-500 md:text-xs">
            Click a row to inspect which roles can see that menu item and which permissions unlock it.
          </p>
        </div>

        {error ? (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[11px] md:text-xs">
            <thead>
              <tr className="border-y border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                <th className="w-20 px-3 py-2">Order</th>
                <th className="px-3 py-2">Menu Item</th>
                <th className="px-3 py-2">Route</th>
                <th className="px-3 py-2">Required Permissions</th>
                <th className="px-3 py-2">Your Access</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-[11px] text-zinc-500">
                    Loading navigation rules...
                  </td>
                </tr>
              ) : (
                rows.map((item, index) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50"
                    onClick={() =>
                      setSelectedItem({
                        id: item.id,
                        label: menuItems[index]?.label ?? item.label,
                        path: item.url,
                        depth: menuItems[index]?.depth ?? 0,
                        requiredPermissions: menuItems[index]?.requiredPermissions ?? [],
                      })
                    }
                  >
                    <td className="px-3 py-2 align-top text-[10px] text-zinc-500">{item.sortOrder}</td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-900 md:text-xs">{item.label}</td>
                    <td className="px-3 py-2 align-top text-[11px] text-blue-700 md:text-xs">{item.url}</td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-700 md:text-xs">
                      {item.requiredPermission || "Program access only"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                            : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                        }`}
                      >
                        {item.status === "Active" ? "Visible" : "Hidden"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DrawerShell
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.label ?? "Menu item"}
        description={selectedItem?.path ?? undefined}
        footer={
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            onClick={() => setSelectedItem(null)}
          >
            Close
          </button>
        }
      >
        {selectedItem ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Metric label="Required keys" value={selectedItem.requiredPermissions.length} />
              <Metric
                label="Roles with access"
                value={roles.filter((role) =>
                  hasRequiredPermissions(
                    new Set(role.permissions.map((permission) => permission.toLowerCase())),
                    selectedItem.requiredPermissions,
                  ),
                ).length}
              />
              <Metric
                label="Current admin"
                value={hasRequiredPermissions(currentPermissionSet, selectedItem.requiredPermissions) ? 1 : 0}
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-900">Required permissions</h3>
              <div className="flex flex-wrap gap-2">
                {selectedItem.requiredPermissions.length > 0 ? (
                  selectedItem.requiredPermissions.map((permission) => (
                    <span
                      key={permission}
                      className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100"
                    >
                      {permission}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-zinc-500">This item only requires access to the program workspace.</span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900">Role access preview</h3>
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                      <th className="px-3 py-2 font-semibold">Role</th>
                      <th className="px-3 py-2 font-semibold">Permissions</th>
                      <th className="px-3 py-2 font-semibold">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {roles.map((role) => {
                      const canAccess = hasRequiredPermissions(
                        new Set(role.permissions.map((permission) => permission.toLowerCase())),
                        selectedItem.requiredPermissions,
                      );

                      return (
                        <tr key={role.id}>
                          <td className="px-3 py-2 text-zinc-900">{role.name}</td>
                          <td className="px-3 py-2 text-zinc-600">
                            {role.permissions.length > 0 ? role.permissions.join(", ") : "No permissions"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                canAccess
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                  : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"
                              }`}
                            >
                              {canAccess ? "Visible" : "Hidden"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </DrawerShell>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "blue" | "emerald" | "amber" | "purple";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-100"
      : tone === "emerald"
        ? "bg-emerald-100"
        : tone === "amber"
          ? "bg-amber-100"
          : "bg-purple-100";

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5">
      <div>
        <div className="text-[11px] font-medium text-zinc-500">{label}</div>
        <div className="text-lg font-semibold text-zinc-900 md:text-xl">{value}</div>
      </div>
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${toneClass}`}>{icon}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
