"use client";

import { useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  KeyIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { AdminManagementHeader } from "./adminManagement/AdminManagementHeader";
import { AdminManagementTable } from "./adminManagement/AdminManagementTable";

export type AdminStatus = "Active" | "Inactive";

export type AdminRole =
  | "Super Admin"
  | "Project Manager"
  | "Tnd"
  | "Reviewer"
  | "Ambassador Coordinator"
  | "Mentor"
  | "News Writer"
  | "Digital Marketing";

export type AdminRow = {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  programs: string[];
  status: AdminStatus;
  lastLogin: string;
};

const mockAdmins: AdminRow[] = [
  {
    id: 1,
    name: "Hilmi Farrel",
    email: "hilmi@ybb.org",
    role: "Super Admin",
    programs: ["Istanbul Youth Summit 2026", "Japan Youth Summit 2026"],
    status: "Active",
    lastLogin: "Today, 09:12 AM",
  },
  {
    id: 2,
    name: "Nabila Putri",
    email: "nabila@ybb.org",
    role: "Project Manager",
    programs: ["Japan Youth Summit 2026"],
    status: "Active",
    lastLogin: "Yesterday, 10:45 PM",
  },
  {
    id: 3,
    name: "Andi Pratama",
    email: "andi@ybb.org",
    role: "Reviewer",
    programs: ["Istanbul Youth Summit 2026"],
    status: "Inactive",
    lastLogin: "7 days ago",
  },
];

export type AdminManagementProps = {
  programName: string;
  allPrograms: string[];
};

export function AdminManagement({ programName, allPrograms }: AdminManagementProps) {
  const [admins, setAdmins] = useState<AdminRow[]>(mockAdmins);
  const [roleFilter, setRoleFilter] = useState<AdminRole | "All Roles">("All Roles");
  const [programFilter, setProgramFilter] = useState<string | "All Programs">(
    "All Programs",
  );
  const [statusFilter, setStatusFilter] = useState<AdminStatus | "All Status">(
    "All Status",
  );
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminRow | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminRow | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetAdmin, setResetTargetAdmin] = useState<AdminRow | null>(null);

  const totalAdmins = admins.length;
  const activeAdmins = admins.filter((admin) => admin.status === "Active").length;
  const superAdmins = admins.filter((admin) => admin.role === "Super Admin").length;
  const recentLogins = 5;

  const filteredAdmins = admins.filter((admin) => {
    const matchesRole =
      roleFilter === "All Roles" ? true : admin.role === roleFilter;
    const matchesProgram =
      programFilter === "All Programs"
        ? true
        : admin.programs.some((program) => program === programFilter);
    const matchesStatus =
      statusFilter === "All Status" ? true : admin.status === statusFilter;

    const matchesSearch = (() => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        admin.name.toLowerCase().includes(q) ||
        admin.email.toLowerCase().includes(q) ||
        admin.role.toLowerCase().includes(q) ||
        admin.programs.join(", ").toLowerCase().includes(q)
      );
    })();

    return matchesRole && matchesProgram && matchesStatus && matchesSearch;
  });

  const handleSubmitAdmin = (payload: Omit<AdminRow, "id"> & { id?: number }) => {
    if (editingAdmin) {
      const updated: AdminRow = {
        id: editingAdmin.id,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        programs: payload.programs,
        status: payload.status,
        lastLogin: payload.lastLogin,
      };

      setAdmins((prev) => prev.map((admin) => (admin.id === editingAdmin.id ? updated : admin)));
      console.log("Edit administrator:", updated);
    } else {
      const newId = admins.length > 0 ? Math.max(...admins.map((a) => a.id)) + 1 : 1;
      const created: AdminRow = {
        id: newId,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        programs: payload.programs,
        status: payload.status,
        lastLogin: payload.lastLogin || "Not logged in yet",
      };

      setAdmins((prev) => [...prev, created]);
      console.log("Create administrator:", created);
    }

    setShowFormModal(false);
    setEditingAdmin(null);
  };

  const handleConfirmResetPassword = (newPassword: string) => {
    if (!resetTargetAdmin) return;
    console.log("Reset password for administrator:", {
      admin: resetTargetAdmin,
      newPassword,
    });
    setShowResetModal(false);
    setResetTargetAdmin(null);
  };

  return (
    <main className="space-y-4 text-sm md:text-base">
      <AdminManagementHeader
        programName={programName}
        totalAdmins={totalAdmins}
        activeAdmins={activeAdmins}
        superAdmins={superAdmins}
        recentLogins={recentLogins}
      />

      <AdminManagementTable
        admins={filteredAdmins}
        roleFilter={roleFilter}
        onChangeRoleFilter={(value) => setRoleFilter(value)}
        programFilter={programFilter}
        onChangeProgramFilter={(value) => setProgramFilter(value)}
        statusFilter={statusFilter}
        onChangeStatusFilter={(value) => setStatusFilter(value)}
        search={search}
        onChangeSearch={(value) => setSearch(value)}
        allPrograms={allPrograms}
        onAddAdmin={() => {
          setEditingAdmin(null);
          setShowFormModal(true);
        }}
        onViewAdmin={(admin) => {
          setSelectedAdmin(admin);
          setShowDetailModal(true);
        }}
        onEditAdmin={(admin) => {
          setEditingAdmin(admin);
          setShowFormModal(true);
        }}
        onResetPassword={(admin) => {
          setResetTargetAdmin(admin);
          setShowResetModal(true);
        }}
        onDeleteAdmin={(admin) => {
          console.log("Delete administrator (placeholder):", admin);
        }}
      />
      {showFormModal && (
        <AdminFormModal
          isOpen={showFormModal}
          onClose={() => {
            setShowFormModal(false);
            setEditingAdmin(null);
          }}
          onSubmit={handleSubmitAdmin}
          admin={editingAdmin}
          allPrograms={allPrograms}
        />
      )}
      {showDetailModal && selectedAdmin && (
        <AdminDetailModal
          admin={selectedAdmin}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedAdmin(null);
          }}
        />
      )}
      {showResetModal && resetTargetAdmin && (
        <AdminResetPasswordModal
          admin={resetTargetAdmin}
          onConfirm={handleConfirmResetPassword}
          onClose={() => {
            setShowResetModal(false);
            setResetTargetAdmin(null);
          }}
        />
      )}
    </main>
  );
}

type AdminFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Omit<AdminRow, "id"> & { id?: number }) => void;
  admin: AdminRow | null;
  allPrograms: string[];
};

function AdminFormModal({ isOpen, onClose, onSubmit, admin, allPrograms }: AdminFormModalProps) {
  const isEditMode = Boolean(admin);

  const [name, setName] = useState(() => admin?.name ?? "");
  const [email, setEmail] = useState(() => admin?.email ?? "");
  const [role, setRole] = useState<AdminRole>(() => admin?.role ?? "Super Admin");
  const [status, setStatus] = useState<AdminStatus>(() => admin?.status ?? "Active");
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(() => admin?.programs ?? []);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const programs = selectedPrograms;

    const payload: Omit<AdminRow, "id"> & { id?: number } = {
      name,
      email,
      role,
      programs,
      status,
      lastLogin: admin?.lastLogin ?? "Not logged in yet",
      id: admin?.id,
    };

    onSubmit(payload);
  };

  const handleToggleProgram = (program: string) => {
    setSelectedPrograms((prev) => {
      if (prev.includes(program)) {
        return prev.filter((item) => item !== program);
      }
      return [...prev, program];
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Administrator" : "Add Administrator"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the administrator's basic information, role, programs, and status."
                : "Create a new administrator and assign roles and programs."}
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
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., Hilmi Farrel"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., admin@ybb.org"
                  required
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                    Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as AdminRole)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Project Manager">Project Manager</option>
                    <option value="Tnd">Tnd</option>
                    <option value="Reviewer">Reviewer</option>
                    <option value="Ambassador Coordinator">Ambassador Coordinator</option>
                    <option value="Mentor">Mentor</option>
                    <option value="News Writer">News Writer</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                    Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as AdminStatus)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Programs <span className="text-rose-500">*</span>
                </label>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs">
                  {allPrograms.map((program) => (
                    <label
                      key={program}
                      className="flex items-center gap-2 py-0.5 text-[11px] text-zinc-700"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedPrograms.includes(program)}
                        onChange={() => handleToggleProgram(program)}
                      />
                      <span className="line-clamp-1">{program}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-zinc-400">
                  Select one or more programs where this administrator has access.
                </p>
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
              {isEditMode ? "Save Changes" : "Add Administrator"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type AdminDetailModalProps = {
  admin: AdminRow;
  onClose: () => void;
};

function AdminDetailModal({ admin, onClose }: AdminDetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              Administrator Details
            </h3>
            <p className="text-[11px] text-zinc-500">
              Overview of administrator profile, role, and program assignments.
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
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
              {admin.name
                .split(" ")
                .map((part) => part.charAt(0))
                .join("")
                .slice(0, 2)}
            </span>
            <div>
              <div className="text-sm font-semibold text-zinc-900 md:text-base">
                {admin.name}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-zinc-500 md:text-xs">
                <EnvelopeIcon className="h-3.5 w-3.5" />
                <span>{admin.email}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Role
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200">
                <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
                <span>{admin.role}</span>
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  admin.status === "Active"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                }`}
              >
                {admin.status === "Active" ? (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                ) : (
                  <ClockIcon className="h-3.5 w-3.5" />
                )}
                <span>{admin.status}</span>
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Last Login
              </div>
              <div className="text-sm font-medium text-zinc-900">{admin.lastLogin}</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Programs
            </div>
            <div className="flex flex-wrap gap-1.5">
              {admin.programs.map((program) => (
                <span
                  key={program}
                  className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100"
                >
                  {program}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
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
    </div>
  );
}

type AdminResetPasswordModalProps = {
  admin: AdminRow;
  onConfirm: (newPassword: string) => void;
  onClose: () => void;
};

function AdminResetPasswordModal({ admin, onConfirm, onClose }: AdminResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    onConfirm(newPassword);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              Reset Administrator Password
            </h3>
            <p className="text-[11px] text-zinc-500">
              Confirm to send a password reset instruction to this administrator.
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
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-purple-50 text-purple-700">
              <KeyIcon className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-zinc-700 md:text-sm">
                Warning: You are about to reset the password for
                {" "}
                <span className="font-semibold text-zinc-900">{admin.name}</span>.
                {" "}
                The admin will need to use this new password to log in.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                New Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
              <p className="mt-1 text-[10px] text-zinc-400">
                Password must be at least 8 characters long.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                required
              />
            </div>
            {error && (
              <p className="text-[11px] font-medium text-rose-600">{error}</p>
            )}
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
              className="rounded-md border border-purple-500 bg-purple-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-600 md:text-sm"
            >
              Confirm Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
