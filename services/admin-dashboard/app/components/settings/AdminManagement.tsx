"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  KeyIcon,
  PlusIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { EnglishInput } from "@/src/ui/english-input";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  createAdmin,
  deleteAdmin,
  getAdmin,
  listAdminRoles,
  listAdmins,
  resetAdminPassword,
  updateAdmin,
  type Admin,
  type AdminRole as ApiAdminRole,
  type CreateAdminInput,
  type UpdateAdminInput,
} from "@/src/shared/api-client";

export type AdminStatus = "Active" | "Inactive";
export type AdminRole = string;

export type AdminRow = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  programs: string[];
  status: AdminStatus;
  lastLogin: string;
};

export type AdminManagementProps = {
  programId: string;
  programName: string;
  allPrograms: string[];
};

type AdminFormState = {
  fullName: string;
  email: string;
  password: string;
  roleId: string;
  isActive: boolean;
  programIds: string[];
};

const defaultFormState: AdminFormState = {
  fullName: "",
  email: "",
  password: "",
  roleId: "",
  isActive: true,
  programIds: [],
};

function formatLastLogin(value?: string | null): string {
  if (!value) return "Not logged in yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function adminToRow(admin: Admin): AdminRow {
  return {
    id: admin.id,
    name: admin.fullName,
    email: admin.user.email,
    role: admin.role?.name ?? "No Role",
    programs: admin.programs?.map((program) => program.programName) ?? [],
    status: admin.user.isActive ? "Active" : "Inactive",
    lastLogin: formatLastLogin(admin.lastLoginAt),
  };
}

export function AdminManagement({ programId, programName }: AdminManagementProps) {
  const { accessiblePrograms, accessConfig } = useAuth();
  const resolvedProgramId = useResolvedProgramId(programId);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<ApiAdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminStatus>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [form, setForm] = useState<AdminFormState>(defaultFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const canManageAdmins = accessConfig.canManageAdmins;

  const programOptions = useMemo(
    () =>
      accessiblePrograms.map((program) => ({
        id: program.programId,
        name: program.programName,
      })),
    [accessiblePrograms],
  );

  const loadData = useCallback(async () => {
    if (!canManageAdmins) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [adminsResponse, roleResponse] = await Promise.all([
        listAdmins({ page: 1, limit: 100, programId: resolvedProgramId }),
        listAdminRoles({ programId: resolvedProgramId }),
      ]);

      setAdmins(adminsResponse.data);
      setRoles(roleResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load administrators.");
    } finally {
      setLoading(false);
    }
  }, [canManageAdmins, resolvedProgramId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredAdmins = useMemo(() => {
    return admins.filter((admin) => {
      const matchesSearch =
        search.trim().length === 0 ||
        [admin.fullName, admin.user.email, admin.role?.name ?? "", ...(admin.programs?.map((program) => program.programName) ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase());

      const matchesRole = roleFilter === "all" || admin.roleId === roleFilter;
      const adminStatus: AdminStatus = admin.user.isActive ? "Active" : "Inactive";
      const matchesStatus = statusFilter === "all" || adminStatus === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [admins, roleFilter, search, statusFilter]);

  const summaryRows = filteredAdmins.map(adminToRow);
  const totalAdmins = filteredAdmins.length;
  const activeAdmins = filteredAdmins.filter((admin) => admin.user.isActive).length;
  const superAdmins = filteredAdmins.filter((admin) => admin.role?.name === "Super Admin").length;
  const recentLogins = filteredAdmins.filter((admin) => Boolean(admin.lastLoginAt)).length;

  const openCreateDrawer = () => {
    setSelectedAdmin(null);
    setForm({
      ...defaultFormState,
      roleId: roles[0]?.id ?? "",
      programIds: resolvedProgramId ? [resolvedProgramId] : [],
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = async (admin: Admin) => {
    setSaving(true);
    setFormError(null);
    try {
      const detail = await getAdmin(admin.id);
      setSelectedAdmin(detail);
      setForm({
        fullName: detail.fullName,
        email: detail.user.email,
        password: "",
        roleId: detail.roleId ?? "",
        isActive: detail.user.isActive,
        programIds: detail.programs?.map((program) => program.programId) ?? [resolvedProgramId],
      });
      setDrawerOpen(true);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Failed to load administrator.");
    } finally {
      setSaving(false);
    }
  };

  const openDetailDrawer = async (admin: Admin) => {
    try {
      const detail = await getAdmin(admin.id);
      setSelectedAdmin(detail);
      setDetailOpen(true);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Failed to load administrator.");
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFormError(null);

    try {
      if (!form.roleId) {
        throw new Error("Select a role before saving.");
      }

      if (form.programIds.length === 0) {
        throw new Error("Assign at least one program.");
      }

      if (selectedAdmin) {
        const payload: UpdateAdminInput = {
          fullName: form.fullName.trim(),
          roleId: form.roleId,
          isActive: form.isActive,
          programIds: form.programIds,
        };
        await updateAdmin(selectedAdmin.id, payload);
        toast.success("Administrator updated.");
      } else {
        if (form.password.trim().length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }

        const payload: CreateAdminInput = {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          roleId: form.roleId,
          programIds: form.programIds,
        };
        await createAdmin(payload);
        toast.success("Administrator created.");
      }

      setDrawerOpen(false);
      setSelectedAdmin(null);
      setForm(defaultFormState);
      await loadData();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Failed to save administrator.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin: Admin) => {
    if (!window.confirm(`Deactivate ${admin.fullName}?`)) {
      return;
    }

    try {
      await deleteAdmin(admin.id);
      toast.success("Administrator deactivated.");
      await loadData();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Failed to deactivate administrator.");
    }
  };

  const handleResetPassword = async () => {
    if (!selectedAdmin) return;

    setResettingPassword(true);
    setPasswordError(null);

    try {
      if (password.trim().length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      await resetAdminPassword(selectedAdmin.id, password);
      toast.success("Password reset.");
      setPassword("");
      setPasswordOpen(false);
    } catch (resetError) {
      setPasswordError(resetError instanceof Error ? resetError.message : "Failed to reset password.");
    } finally {
      setResettingPassword(false);
    }
  };

  if (!canManageAdmins) {
    return (
      <section className="rounded-md border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-600 shadow-sm">
        This program role cannot manage administrators.
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
          <h1 className="text-base font-semibold text-zinc-900 md:text-lg">Administrator Management</h1>
          <p className="text-xs text-zinc-500 md:text-sm">
            Create real program admins, assign roles, reset passwords, and control which programs they can access.
          </p>
          <p className="text-[11px] text-zinc-400 md:text-xs">
            Currently viewing administrators for: <span className="font-medium">{programName}</span>
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCard label="Total Admins" value={totalAdmins} icon={<UserGroupIcon className="h-5 w-5 text-blue-600" />} tone="blue" />
          <SummaryCard label="Active Admins" value={activeAdmins} icon={<CheckCircleIcon className="h-5 w-5 text-emerald-600" />} tone="emerald" />
          <SummaryCard label="Super Admins" value={superAdmins} icon={<KeyIcon className="h-5 w-5 text-amber-600" />} tone="amber" />
          <SummaryCard label="Recent Logins" value={recentLogins} icon={<ClockIcon className="h-5 w-5 text-purple-600" />} tone="purple" />
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:px-5 md:py-4 md:text-sm">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program administrators</h2>
            <p className="text-[11px] text-zinc-500 md:text-xs">
              This list is live and only shows admins currently assigned to this program.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
            onClick={openCreateDrawer}
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add Administrator</span>
          </button>
        </div>

        <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, role, or program..."
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Role</label>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:text-xs"
            >
              <option value="all">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | AdminStatus)}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:text-xs"
            >
              <option value="all">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[11px] md:text-xs">
            <thead>
              <tr className="border-y border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                <th className="w-10 px-3 py-2">No.</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Programs</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last Login</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-[11px] text-zinc-500">
                    Loading administrators...
                  </td>
                </tr>
              ) : summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-[11px] text-zinc-500">
                    No administrators found for this program.
                  </td>
                </tr>
              ) : (
                summaryRows.map((admin, index) => {
                  const source = filteredAdmins[index];
                  return (
                    <tr key={admin.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-3 py-2 align-top text-[10px] text-zinc-500">{index + 1}</td>
                      <td className="px-3 py-2 align-top">
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-semibold text-zinc-900 md:text-xs">{admin.name}</div>
                          <div className="text-[10px] text-zinc-500">{admin.email}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-zinc-700 md:text-xs">{admin.role}</td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {admin.programs.map((program) => (
                            <span
                              key={`${admin.id}-${program}`}
                              className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-100"
                            >
                              {program}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            admin.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                              : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                          }`}
                        >
                          {admin.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-[10px] text-zinc-600">{admin.lastLogin}</td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionButton label="View" onClick={() => void openDetailDrawer(source)} tone="blue" />
                          <ActionButton label="Edit" onClick={() => void openEditDrawer(source)} tone="amber" />
                          <ActionButton
                            label="Password"
                            onClick={() => {
                              setSelectedAdmin(source);
                              setPassword("");
                              setPasswordError(null);
                              setPasswordOpen(true);
                            }}
                            tone="purple"
                          />
                          <ActionButton label="Deactivate" onClick={() => void handleDelete(source)} tone="rose" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DrawerShell
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedAdmin(null);
          setForm(defaultFormState);
          setFormError(null);
        }}
        title={selectedAdmin ? "Edit administrator" : "Add administrator"}
        description={
          selectedAdmin
            ? "Update this admin's role, program assignments, and access status."
            : "Create a real admin account with a password and assign it to one or more programs."
        }
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
              {saving ? "Saving..." : selectedAdmin ? "Save changes" : "Create administrator"}
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Full name</label>
            <EnglishInput
              type="text"
              restrictMode="name"
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
            <input
              type="email"
              value={form.email}
              disabled={Boolean(selectedAdmin)}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-50"
            />
          </div>
          {!selectedAdmin ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Minimum 8 characters"
                className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Role</label>
            <select
              value={form.roleId}
              onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700">Programs</label>
            <span className="text-xs text-zinc-500">Assign one or more program workspaces.</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {programOptions.map((program) => {
              const checked = form.programIds.includes(program.id);
              return (
                <label
                  key={program.id}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                    checked ? "border-blue-300 bg-blue-50 text-blue-900" : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        programIds: checked
                          ? current.programIds.filter((id) => id !== program.id)
                          : [...current.programIds, program.id],
                      }))
                    }
                  />
                  <span>{program.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {selectedAdmin ? (
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active account
          </label>
        ) : null}
      </DrawerShell>

      <DrawerShell
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedAdmin(null);
        }}
        title={selectedAdmin?.fullName ?? "Administrator"}
        description={selectedAdmin?.user.email ?? "Administrator details"}
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
        {selectedAdmin ? (
          <div className="grid gap-6 md:grid-cols-2">
            <DetailBlock label="Role" value={selectedAdmin.role?.name ?? "No Role"} />
            <DetailBlock label="Status" value={selectedAdmin.user.isActive ? "Active" : "Inactive"} />
            <DetailBlock label="Last login" value={formatLastLogin(selectedAdmin.lastLoginAt)} />
            <DetailBlock
              label="Programs"
              value={(selectedAdmin.programs?.map((program) => program.programName).join(", ") || "None assigned")}
            />
            <DetailBlock
              label="Brands"
              value={(selectedAdmin.brands?.map((brand) => brand.brandName).join(", ") || "None assigned")}
            />
            <DetailBlock
              label="Permissions"
              value={selectedAdmin.role?.permissions?.join(", ") || "No permissions configured"}
            />
          </div>
        ) : null}
      </DrawerShell>

      <DrawerShell
        open={passwordOpen}
        onClose={() => {
          setPasswordOpen(false);
          setPassword("");
          setPasswordError(null);
        }}
        title="Reset password"
        description={selectedAdmin ? `Set a new password for ${selectedAdmin.fullName}.` : undefined}
        error={passwordError}
        locked={resettingPassword}
        footer={
          <>
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              onClick={() => setPasswordOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-blue-500 bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
              onClick={() => void handleResetPassword()}
              disabled={resettingPassword}
            >
              {resettingPassword ? "Saving..." : "Reset password"}
            </button>
          </>
        }
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">New password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 8 characters"
            className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
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
  tone: "blue" | "amber" | "purple" | "rose";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : tone === "purple"
          ? "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
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

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-900">{value}</div>
    </div>
  );
}
