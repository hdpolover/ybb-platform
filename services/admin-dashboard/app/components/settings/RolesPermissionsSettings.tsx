"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  BriefcaseIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  KeyIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { RolesPermissionsHeader } from "./rolesPermissions/RolesPermissionsHeader";
import { RolesPermissionsRolesSection } from "./rolesPermissions/RolesPermissionsRolesSection";
import { RolesPermissionsPermissionCategories } from "./rolesPermissions/RolesPermissionsPermissionCategories";

export type RoleRow = {
  id: number;
  roleName: string; // contoh: "super_admin"
  displayName: string; // contoh: "Super Administrator"
  permissionsCount: number;
  usersCount: number;
  // Field detail opsional buat View Details modal (sementara masih mock doang)
  description?: string;
  accessLevel?: number;
  status?: "active" | "inactive";
  users?: {
    name: string;
    email: string;
    status: "Active" | "Inactive";
  }[];
  permissions?: string[];
  createdAt?: string; // string tanggal yang udah di-format, cuma buat tampilan
  updatedAt?: string; // string update terakhir yang udah di-format, cuma buat tampilan
};

export type PermissionCategory = {
  id: string;
  name: string;
  icon: ReactNode;
  permissions: string[];
};

export type RolesPermissionsSettingsProps = {
  programName: string;
};

const mockRoles: RoleRow[] = [
  {
    id: 1,
    roleName: "super_admin",
    displayName: "Super Administrator",
    permissionsCount: 30,
    usersCount: 3,
    description: "Full system access, can manage all admins and settings.",
    accessLevel: 10,
    status: "active",
    users: [
      {
        name: "Super Administrator",
        email: "superadmin@ybb.org",
        status: "Active",
      },
      {
        name: "Qoriah Indah Susilowati",
        email: "qoriahindahsusilowati204@gmail.com",
        status: "Active",
      },
      {
        name: "Maira",
        email: "humairasyabani@gmail.com",
        status: "Active",
      },
    ],
    permissions: [
      "view_ambassador_dashboard",
      "export_ambassadors",
      "manage_ambassadors",
      "view_ambassadors",
      "manage_essays",
      "review_content",
      "view_essays",
      "export_data",
      "view_analytics",
      "view_dashboard",
      "manage_announcements",
      "manage_news",
      "publish_content",
      "view_news",
      "export_participants",
      "manage_participants",
      "view_participants",
      "view_financial_reports",
      "manage_payments",
      "view_payments",
      "manage_programs",
      "view_program_settings",
      "view_programs",
      "manage_scores",
      "view_rankings",
      "view_scores",
      "manage_admins",
      "manage_roles",
      "system_settings",
      "view_system_logs",
    ],
    createdAt: "August 27, 2025 at 12:08 PM",
    updatedAt: "August 27, 2025 at 12:08 PM",
  },
  {
    id: 2,
    roleName: "project_manager",
    displayName: "Project Manager",
    permissionsCount: 28,
    usersCount: 0,
  },
  {
    id: 3,
    roleName: "tnd",
    displayName: "Training & Development",
    permissionsCount: 9,
    usersCount: 1,
  },
  {
    id: 4,
    roleName: "reviewer",
    displayName: "Content Reviewer",
    permissionsCount: 6,
    usersCount: 1,
  },
];

const permissionCategories: PermissionCategory[] = [
  {
    id: "ambassadors",
    name: "Ambassadors",
    icon: <UserGroupIcon className="h-4 w-4 text-blue-500" />,
    permissions: [
      "view_ambassador_dashboard",
      "export_ambassadors",
      "manage_ambassadors",
      "view_ambassadors",
    ],
  },
  {
    id: "content",
    name: "Content",
    icon: <ClipboardDocumentListIcon className="h-4 w-4 text-purple-500" />,
    permissions: ["manage_essays", "review_content", "view_essays"],
  },
  {
    id: "content-management",
    name: "Content Management",
    icon: <Squares2X2Icon className="h-4 w-4 text-emerald-500" />,
    permissions: ["view_announcements"],
  },
  {
    id: "dashboard",
    name: "Dashboard",
    icon: <Squares2X2Icon className="h-4 w-4 text-sky-500" />,
    permissions: ["export_data", "view_analytics", "view_dashboard"],
  },
  {
    id: "document-management",
    name: "Document Management",
    icon: <ClipboardDocumentListIcon className="h-4 w-4 text-amber-500" />,
    permissions: ["manage_documents", "view_documents"],
  },
  {
    id: "news",
    name: "News",
    icon: <ClipboardDocumentListIcon className="h-4 w-4 text-rose-500" />,
    permissions: [
      "manage_announcements",
      "manage_news",
      "publish_content",
      "view_news",
    ],
  },
  {
    id: "participants",
    name: "Participants",
    icon: <UserGroupIcon className="h-4 w-4 text-indigo-500" />,
    permissions: ["export_participants", "manage_participants", "view_participants"],
  },
  {
    id: "payments",
    name: "Payments",
    icon: <KeyIcon className="h-4 w-4 text-emerald-600" />,
    permissions: [
      "view_financial_reports",
      "manage_payments",
      "view_payments",
    ],
  },
  {
    id: "programs",
    name: "Programs",
    icon: <BriefcaseIcon className="h-4 w-4 text-blue-600" />,
    permissions: ["manage_programs", "view_program_settings", "view_programs"],
  },
  {
    id: "scoring",
    name: "Scoring",
    icon: <ShieldCheckIcon className="h-4 w-4 text-amber-600" />,
    permissions: ["manage_scores", "view_rankings", "view_scores"],
  },
  {
    id: "system",
    name: "System",
    icon: <Cog6ToothIcon className="h-4 w-4 text-zinc-600" />,
    permissions: [
      "manage_admins",
      "manage_roles",
      "system_settings",
      "view_system_logs",
    ],
  },
];

export function RolesPermissionsSettings({ programName }: RolesPermissionsSettingsProps) {
  const [roles, setRoles] = useState<RoleRow[]>(mockRoles);
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetRole, setDeleteTargetRole] = useState<RoleRow | null>(null);

  const totalRoles = roles.length;
  const totalPermissions = useMemo(
    () => permissionCategories.reduce((sum, category) => sum + category.permissions.length, 0),
    [],
  );
  const activeRoles = roles.length; // mock: anggep aja semua role lagi aktif
  const permissionCategoriesCount = permissionCategories.length;

  const filteredRoles = roles.filter((role) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      role.roleName.toLowerCase().includes(q) ||
      role.displayName.toLowerCase().includes(q)
    );
  });

  const handleSubmitRole = (payload: Omit<RoleRow, "id"> & { id?: number }) => {
    if (editingRole) {
      const updated: RoleRow = {
        id: editingRole.id,
        roleName: payload.roleName,
        displayName: payload.displayName,
        permissionsCount: payload.permissionsCount,
        usersCount: payload.usersCount,
      };

      setRoles((previous) => previous.map((role) => (role.id === editingRole.id ? updated : role)));
      console.log("Edit role:", updated);
    } else {
      const newId = roles.length > 0 ? Math.max(...roles.map((role) => role.id)) + 1 : 1;
      const created: RoleRow = {
        id: newId,
        roleName: payload.roleName,
        displayName: payload.displayName,
        permissionsCount: payload.permissionsCount,
        usersCount: payload.usersCount,
      };

      setRoles((previous) => [...previous, created]);
      console.log("Create role:", created);
    }

    setShowFormModal(false);
    setEditingRole(null);
  };

  const handleConfirmDeleteRole = () => {
    if (!deleteTargetRole) return;
    console.log("Delete role:", deleteTargetRole);
    setRoles((previous) => previous.filter((role) => role.id !== deleteTargetRole.id));
    setShowDeleteModal(false);
    setDeleteTargetRole(null);
  };

  return (
    <main className="space-y-4 text-sm md:text-base">
      <RolesPermissionsHeader
        programName={programName}
        totalRoles={totalRoles}
        totalPermissions={totalPermissions}
        activeRoles={activeRoles}
        permissionCategoriesCount={permissionCategoriesCount}
      />

      <section className="space-y-3">
        <RolesPermissionsRolesSection
          roles={filteredRoles}
          search={search}
          onChangeSearch={setSearch}
          onCreateRole={() => {
            setEditingRole(null);
            setShowFormModal(true);
          }}
          onViewRole={(role) => {
            setSelectedRole(role);
            setShowDetailModal(true);
          }}
          onEditRole={(role) => {
            setEditingRole(role);
            setShowFormModal(true);
          }}
          onDeleteRole={(role) => {
            setDeleteTargetRole(role);
            setShowDeleteModal(true);
          }}
        />

        <RolesPermissionsPermissionCategories categories={permissionCategories} />
      </section>
      {showFormModal && (
        <RoleFormModal
          isOpen={showFormModal}
          role={editingRole}
          onClose={() => {
            setShowFormModal(false);
            setEditingRole(null);
          }}
          onSubmit={handleSubmitRole}
        />
      )}
      {showDetailModal && selectedRole && (
        <RoleDetailModal
          role={selectedRole}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedRole(null);
          }}
        />
      )}
      {showDeleteModal && deleteTargetRole && (
        <RoleDeleteConfirmModal
          role={deleteTargetRole}
          onConfirm={handleConfirmDeleteRole}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteTargetRole(null);
          }}
        />
      )}
    </main>
  );
}

type RoleFormModalProps = {
  isOpen: boolean;
  role: RoleRow | null;
  onClose: () => void;
  onSubmit: (payload: Omit<RoleRow, "id"> & { id?: number }) => void;
};

function RoleFormModal({ isOpen, role, onClose, onSubmit }: RoleFormModalProps) {
  const isEditMode = Boolean(role);

  const [roleName, setRoleName] = useState(() => role?.roleName ?? "");
  const [displayName, setDisplayName] = useState(() => role?.displayName ?? "");
  const [usersCount, setUsersCount] = useState<number>(() => role?.usersCount ?? 0);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    () => role?.permissions ?? [],
  );

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: Omit<RoleRow, "id"> & { id?: number } = {
      roleName,
      displayName,
      permissionsCount: selectedPermissions.length,
      usersCount,
      permissions: selectedPermissions,
      id: role?.id,
    };

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Role" : "Create Role"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update role identifier, display name, and usage statistics (mock)."
                : "Define a new role identifier and display name. Permission mapping is mocked for now."}
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-3">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Role Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g., super_admin"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Display Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g., Super Administrator"
                required
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Users Count
                </label>
                <input
                  type="number"
                  min={0}
                  value={usersCount}
                  onChange={(event) => setUsersCount(Number(event.target.value) || 0)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., 1"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Permissions Selected
                </label>
                <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">
                  <KeyIcon className="h-3.5 w-3.5" />
                  <span>{selectedPermissions.length} permissions</span>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Permissions
              </label>
              <p className="mb-2 text-[11px] text-zinc-500">
                Choose which permissions belong to this role. This list is based on the
                permission categories configured above.
              </p>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                {permissionCategories.map((category) => (
                  <div key={category.id} className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                        {category.icon}
                      </span>
                      <span>{category.name}</span>
                    </div>
                    <div className="mt-1 grid gap-1 md:grid-cols-2">
                      {category.permissions.map((permission) => {
                        const checked = selectedPermissions.includes(permission);
                        return (
                          <label
                            key={permission}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[11px] font-mono text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                              checked={checked}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setSelectedPermissions((previous) =>
                                    previous.includes(permission)
                                      ? previous
                                      : [...previous, permission],
                                  );
                                } else {
                                  setSelectedPermissions((previous) =>
                                    previous.filter((item) => item !== permission),
                                  );
                                }
                              }}
                            />
                            <span className="truncate">{permission}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
            >
              {isEditMode ? "Save Changes" : "Create Role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type RoleDetailModalProps = {
  role: RoleRow;
  onClose: () => void;
};

function RoleDetailModal({ role, onClose }: RoleDetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Role Details</h3>
            <p className="text-[11px] text-zinc-500">
              Detailed information about this role, its users, and permissions.
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {/* Info basic seputar role */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Role Name
            </div>
            <div className="text-sm font-semibold text-zinc-900 md:text-base">
              {role.roleName}
            </div>
            <div className="text-[11px] text-zinc-600 md:text-xs">{role.displayName}</div>
          </div>

          {/* Deskripsi, level akses, sama status role */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Description
              </div>
              <p className="text-xs text-zinc-700 md:text-sm">
                {role.description ?? "No description provided for this role."}
              </p>
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Access Level
                </div>
                <div className="inline-flex items-center rounded-md bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200">
                  {role.accessLevel ?? 0}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Status
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    role.status === "inactive"
                      ? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
                      : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      role.status === "inactive" ? "bg-zinc-400" : "bg-emerald-400"
                    }`}
                  />
                  <span>{role.status === "inactive" ? "Inactive" : "Active"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Badge ringkasan jumlah permission, user, dan update */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Permissions
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">
                <KeyIcon className="h-3.5 w-3.5" />
                <span>
                  {(role.permissions?.length ?? role.permissionsCount) || 0} permissions
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Total Users
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100">
                <UserGroupIcon className="h-3.5 w-3.5" />
                <span>{role.users?.length ?? role.usersCount} users</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Updated
              </div>
              <div className="text-[11px] text-zinc-700 md:text-xs">
                {role.updatedAt ?? "-"}
              </div>
            </div>
          </div>

          {/* List user yang lagi make role ini */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Users with this role
              </div>
              <div className="text-[11px] text-zinc-400">
                {(role.users?.length ?? role.usersCount) || 0} users
              </div>
            </div>
            {role.users && role.users.length > 0 ? (
              <div className="space-y-2">
                {role.users.map((user) => (
                  <div
                    key={user.email}
                    className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-medium text-zinc-900">{user.name}</div>
                      <div className="text-[11px] text-zinc-500">{user.email}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>{user.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">No users are currently assigned to this role.</p>
            )}
          </div>

          {/* List permission yang nempel ke role ini */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Permissions
              </div>
              <div className="text-[11px] text-zinc-400">
                {(role.permissions?.length ?? role.permissionsCount) || 0} total
              </div>
            </div>
            {role.permissions && role.permissions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-mono text-zinc-700 ring-1 ring-zinc-200"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    <span className="truncate">{permission}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">
                Permissions for this role are not configured in this mock yet.
              </p>
            )}
          </div>

          {/* Info kapan dibuat & terakhir di-update */}
          <div className="grid gap-3 border-t border-zinc-200 pt-3 text-[11px] text-zinc-500 md:grid-cols-2 md:text-xs">
            <div>
              <span className="font-semibold">Created:</span>{" "}
              <span>{role.createdAt ?? "-"}</span>
            </div>
            <div className="text-left md:text-right">
              <span className="font-semibold">Last Updated:</span>{" "}
              <span>{role.updatedAt ?? "-"}</span>
            </div>
          </div>

        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-2.5">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

type RoleDeleteConfirmModalProps = {
  role: RoleRow;
  onConfirm: () => void;
  onClose: () => void;
};

function RoleDeleteConfirmModal({ role, onConfirm, onClose }: RoleDeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Delete Role</h3>
            <p className="text-[11px] text-zinc-500">
              This action is mocked. In a real implementation you would handle user reassignment.
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-700">
              <TrashIcon className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-zinc-700 md:text-sm">
                Are you sure you want to delete the role
                {" "}
                <span className="font-semibold text-zinc-900">{role.roleName}</span>?
              </p>
              <p className="text-[11px] text-zinc-500">
                Users assigned to this role may lose access depending on your final
                implementation.
              </p>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-rose-500 bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-600 md:text-sm"
              onClick={onConfirm}
            >
              Delete Role
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
