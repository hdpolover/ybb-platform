"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircleIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  createAdminRole,
  deleteAdminRole,
  listAdminRoles,
  updateAdminRole,
  type AdminRole as ApiAdminRole,
} from "@/src/shared/api-client";
import {
  flattenProgramNavSections,
  getRequiredPermissionsForMenuItem,
  hasRequiredPermissions,
  permissionCategories,
} from "@/lib/admin-access";
import { programNavSections } from "@/lib/nav-config";

export type RoleRow = {
  id: string;
  roleName: string;
  displayName: string;
  permissionsCount: number;
  usersCount: number;
  description?: string;
  status?: "active" | "inactive";
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type PermissionCategory = {
  id: string;
  name: string;
  icon?: React.ReactNode;
  permissions: string[];
};

export type RolesPermissionsSettingsProps = {
  programId: string;
  programName: string;
};

type RoleFormState = {
  name: string;
  description: string;
  permissions: string[];
};

const defaultRoleForm: RoleFormState = {
  name: "",
  description: "",
  permissions: [],
};

function mapRole(role: ApiAdminRole): RoleRow {
  return {
    id: role.id,
    roleName: role.name.toLowerCase().replace(/\s+/g, "_"),
    displayName: role.name,
    permissionsCount: role.permissions.length,
    usersCount: role.usersCount ?? 0,
    description: role.description ?? "",
    status: role.isActive ? "active" : "inactive",
    permissions: role.permissions,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export function RolesPermissionsSettings({ programId, programName }: RolesPermissionsSettingsProps) {
  const { accessConfig } = useAuth();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [form, setForm] = useState<RoleFormState>(defaultRoleForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canAssignRoles = accessConfig.canAssignRoles;
  const menuItems = useMemo(() => flattenProgramNavSections(programNavSections), []);

  const loadRoles = useCallback(async () => {
    if (!canAssignRoles) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await listAdminRoles({ programId });
      setRoles(response.map(mapRole));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load roles.");
    } finally {
      setLoading(false);
    }
  }, [canAssignRoles, programId]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      if (!search.trim()) return true;
      const query = search.trim().toLowerCase();
      return (
        role.displayName.toLowerCase().includes(query) ||
        role.roleName.toLowerCase().includes(query) ||
        (role.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [roles, search]);

  const totalRoles = roles.length;
  const totalPermissions = useMemo(
    () => new Set(permissionCategories.flatMap((category) => category.permissions.map((permission) => permission.key))).size,
    [],
  );
  const activeRoles = roles.filter((role) => role.status === "active").length;
  const permissionCategoriesCount = permissionCategories.length;

  const openCreateDrawer = () => {
    setSelectedRole(null);
    setForm(defaultRoleForm);
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (role: RoleRow) => {
    setSelectedRole(role);
    setForm({
      name: role.displayName,
      description: role.description ?? "",
      permissions: role.permissions ?? [],
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const openDetailDrawer = (role: RoleRow) => {
    setSelectedRole(role);
    setDetailOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFormError(null);

    try {
      if (!form.name.trim()) {
        throw new Error("Role name is required.");
      }

      if (form.permissions.length === 0) {
        throw new Error("Select at least one permission.");
      }

      if (selectedRole) {
        await updateAdminRole(selectedRole.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          permissions: form.permissions,
        });
        toast.success("Role updated.");
      } else {
        await createAdminRole({
          name: form.name.trim(),
          description: form.description.trim(),
          permissions: form.permissions,
        });
        toast.success("Role created.");
      }

      setDrawerOpen(false);
      setSelectedRole(null);
      setForm(defaultRoleForm);
      await loadRoles();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Failed to save role.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: RoleRow) => {
    if (!window.confirm(`Delete ${role.displayName}?`)) {
      return;
    }

    try {
      await deleteAdminRole(role.id);
      toast.success("Role deleted.");
      await loadRoles();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Failed to delete role.");
    }
  };

  if (!canAssignRoles) {
    return (
      <section className="rounded-md border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-600 shadow-sm">
        This program role cannot manage admin roles or permissions.
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
          <h1 className="text-base font-semibold text-zinc-900 md:text-lg">Roles &amp; Permissions</h1>
          <p className="text-xs text-zinc-500 md:text-sm">
            Create reusable admin roles for {programName} and control which modules they can access.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCard label="Total Roles" value={totalRoles} icon={<ShieldCheckIcon className="h-5 w-5 text-blue-600" />} tone="blue" />
          <SummaryCard label="Active Roles" value={activeRoles} icon={<CheckCircleIcon className="h-5 w-5 text-emerald-600" />} tone="emerald" />
          <SummaryCard label="Permission Keys" value={totalPermissions} icon={<Squares2X2Icon className="h-5 w-5 text-amber-600" />} tone="amber" />
          <SummaryCard label="Categories" value={permissionCategoriesCount} icon={<UserGroupIcon className="h-5 w-5 text-purple-600" />} tone="purple" />
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:px-5 md:py-4 md:text-sm">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Role definitions</h2>
            <p className="text-[11px] text-zinc-500 md:text-xs">
              Roles are now backed by the API and immediately affect the menu access preview.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
            onClick={openCreateDrawer}
          >
            Create Role
          </button>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or description..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:text-xs"
          />
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
                <th className="w-10 px-3 py-2">No.</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Permissions</th>
                <th className="px-3 py-2">Admins</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-[11px] text-zinc-500">
                    Loading roles...
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-[11px] text-zinc-500">
                    No roles found.
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role, index) => (
                  <tr key={role.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-3 py-2 align-top text-[10px] text-zinc-500">{index + 1}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="space-y-0.5">
                        <div className="text-[11px] font-semibold text-zinc-900 md:text-xs">{role.displayName}</div>
                        <div className="text-[10px] text-zinc-500">{role.roleName}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-600 md:text-xs">
                      {role.description || "No description"}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-700 md:text-xs">
                      {role.permissionsCount}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-700 md:text-xs">
                      {role.usersCount}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionButton label="View" onClick={() => openDetailDrawer(role)} tone="blue" />
                        <ActionButton label="Edit" onClick={() => openEditDrawer(role)} tone="amber" />
                        <ActionButton label="Delete" onClick={() => void handleDelete(role)} tone="rose" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DrawerShell
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedRole(null);
          setForm(defaultRoleForm);
          setFormError(null);
        }}
        title={selectedRole ? "Edit role" : "Create role"}
        description="Roles control access to the program dashboard, content modules, and settings pages."
        error={formError}
        locked={saving}
        footer={
          <>
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              onClick={() => setDrawerOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-blue-500 bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
              onClick={() => void handleSubmit()}
              disabled={saving}
            >
              {saving ? "Saving..." : selectedRole ? "Save changes" : "Create role"}
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Role name</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="space-y-4">
          {permissionCategories.map((category) => (
            <div key={category.id} className="rounded-lg border border-zinc-200">
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-900">{category.name}</h3>
              </div>
              <div className="grid gap-2 px-4 py-4 md:grid-cols-2">
                {category.permissions.map((permission) => {
                  const checked = form.permissions.includes(permission.key);
                  return (
                    <label
                      key={permission.key}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        checked ? "border-blue-300 bg-blue-50 text-blue-900" : "border-zinc-200 bg-white text-zinc-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              permissions: checked
                                ? current.permissions.filter((item) => item !== permission.key)
                                : [...current.permissions, permission.key],
                            }))
                          }
                        />
                        <div>
                          <div className="font-medium">{permission.label}</div>
                          <div className="text-xs text-zinc-500">{permission.description}</div>
                          <div className="mt-1 font-mono text-[10px] text-zinc-400">{permission.key}</div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DrawerShell>

      <DrawerShell
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedRole(null);
        }}
        title={selectedRole?.displayName ?? "Role details"}
        description={selectedRole?.description ?? "Role access summary"}
        footer={
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            onClick={() => setDetailOpen(false)}
          >
            Close
          </button>
        }
      >
        {selectedRole ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Metric label="Admins using role" value={selectedRole.usersCount} />
              <Metric label="Permission keys" value={selectedRole.permissionsCount} />
              <Metric
                label="Visible menus"
                value={menuItems.filter((item) =>
                  hasRequiredPermissions(
                    new Set((selectedRole.permissions ?? []).map((permission) => permission.toLowerCase())),
                    getRequiredPermissionsForMenuItem(item.id),
                  ),
                ).length}
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900">Permissions</h3>
              <div className="flex flex-wrap gap-2">
                {(selectedRole.permissions ?? []).map((permission) => (
                  <span
                    key={permission}
                    className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900">Menu access preview</h3>
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                      <th className="px-3 py-2 font-semibold">Menu item</th>
                      <th className="px-3 py-2 font-semibold">Required permissions</th>
                      <th className="px-3 py-2 font-semibold">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {menuItems.map((item) => {
                      const canAccess = hasRequiredPermissions(
                        new Set((selectedRole.permissions ?? []).map((permission) => permission.toLowerCase())),
                        item.requiredPermissions,
                      );

                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-zinc-900">{`${"— ".repeat(item.depth)}${item.label}`}</td>
                          <td className="px-3 py-2 text-zinc-600">
                            {item.requiredPermissions.length > 0 ? item.requiredPermissions.join(", ") : "Program access only"}
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

function ActionButton({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone: "blue" | "amber" | "rose";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";

  return (
    <button
      type="button"
      className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold shadow-sm ${toneClass}`}
      onClick={onClick}
    >
      {label}
    </button>
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
