"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { AccessRequestsPanel } from "../../components/settings/adminManagement/AccessRequestsPanel";
import {
  SendPasswordLinkDialog,
  type PasswordLinkTarget,
} from "../../components/settings/adminManagement/SendPasswordLinkDialog";
import { InviteAdminDialog } from "../../components/settings/adminManagement/InviteAdminDialog";
import { RoleAndProgramsFields } from "../../components/settings/adminManagement/AdminAccessFields";
import { ExtraPermissionsFields } from "../../components/settings/adminManagement/ExtraPermissionsFields";
import { isPrivilegedPermission, extraPermissionCategories } from "@/lib/admin-access";
import { canSendPasswordLink, isPlatformTierRole } from "@/lib/access-requests";
import {
  listAdmins,
  getAdmin,
  updateAdmin,
  deleteAdmin,
  getPendingAccessRequestCount,
  listAdminRoles,
  type AccessRequestProgram,
  type AdminRole,
  type Admin,
} from "../../../src/shared/api-client";
import { formatDate } from "@/lib/utils";
import { EnglishInput } from "@/src/ui/english-input";

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(isActive: boolean) {
  return isActive ? (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
      Inactive
    </span>
  );
}

const lower = (values: readonly string[]) => values.map((value) => value.trim().toLowerCase());
const catalogKeys = new Set(extraPermissionCategories.flatMap((category) => category.permissions.map((p) => p.key)));

const extraCount = (admin: Admin) => (admin.customPermissions ?? []).filter((key) => !isPrivilegedPermission(key)).length;

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditAdminModal({
  admin,
  roles,
  programs,
  onClose,
  onUpdated,
}: {
  admin: Admin;
  roles: AdminRole[];
  programs: AccessRequestProgram[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [fullName, setFullName] = useState(admin.fullName);
  const [isActive, setIsActive] = useState(admin.user?.isActive ?? true);
  const [roleId, setRoleId] = useState(admin.roleId ?? "");
  const [programIds, setProgramIds] = useState<string[]>([]);
  // Stored custom permissions: only catalog keys are editable; privileged ones are shown and never sent.
  const [extras, setExtras] = useState<string[]>([]);
  const [loadedExtras, setLoadedExtras] = useState<string[]>([]);
  const [loadedRoleId, setLoadedRoleId] = useState("");
  const [legacyPrivileged, setLegacyPrivileged] = useState<string[]>([]);
  // The list rows may not carry program assignments, so fetch the detail before the form is editable.
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdmin(admin.id)
      .then((detail) => {
        if (cancelled) return;
        setRoleId(detail.roleId ?? "");
        setProgramIds(detail.programs?.map((p) => p.programId) ?? detail.programIds ?? []);
        const stored = detail.customPermissions ?? [];
        const storedExtras = lower(stored).filter((key) => catalogKeys.has(key));
        setExtras(storedExtras);
        setLoadedExtras(storedExtras);
        setLoadedRoleId(detail.roleId ?? "");
        setLegacyPrivileged(stored.filter(isPrivilegedPermission));
        setDetailLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load administrator");
      });
    return () => {
      cancelled = true;
    };
  }, [admin.id]);

  const rolePermissions = useMemo(
    () => new Set(lower(roles.find((role) => role.id === roleId)?.permissions ?? [])),
    [roles, roleId],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const selectedRole = roles.find((role) => role.id === roleId);
    if (!roleId) {
      setError("Select a role before saving.");
      return;
    }
    // Platform-tier roles see every program, so only scoped roles need an assignment.
    if (programIds.length === 0 && !(selectedRole && isPlatformTierRole(selectedRole))) {
      setError("Assign at least one program.");
      return;
    }
    setLoading(true);
    try {
      // Extras the role already includes are redundant; send only when the effective set changed.
      const effectiveExtras = extras.filter((key) => !rolePermissions.has(key)).sort();
      const loadedRoleKeys = new Set(lower(roles.find((role) => role.id === loadedRoleId)?.permissions ?? []));
      const baseline = loadedExtras.filter((key) => !loadedRoleKeys.has(key)).sort();
      const extrasChanged = effectiveExtras.join() !== baseline.join();
      await updateAdmin(admin.id, {
        fullName: fullName.trim(),
        roleId,
        isActive,
        programIds,
        ...(extrasChanged ? { customPermissions: effectiveExtras } : {}),
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update admin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Edit Admin</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Full Name</label>
            <EnglishInput
              required
              type="text"
              restrictMode="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <RoleAndProgramsFields
            idPrefix="edit-admin"
            roles={roles}
            roleId={roleId}
            onRoleChange={setRoleId}
            programs={programs}
            programIds={programIds}
            onProgramIdsChange={setProgramIds}
            disabled={!detailLoaded || loading}
          />
          <ExtraPermissionsFields
            rolePermissions={rolePermissions}
            extras={extras}
            onChange={setExtras}
            legacyPrivileged={legacyPrivileged}
            disabled={!detailLoaded || loading}
          />
          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-500"
            />
            <label htmlFor="isActive" className="text-[11px] font-medium text-zinc-700">
              Active account
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !detailLoaded}
              className="rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminsPage() {
  const { adminProfile, accessConfig, accessiblePrograms } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const invitePrograms = useMemo(
    () => accessiblePrograms.map((p) => ({ id: p.programId, name: p.programName, brandName: p.brandName })),
    [accessiblePrograms],
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [linkTarget, setLinkTarget] = useState<PasswordLinkTarget | null>(null);
  const canManageAdmins = accessConfig.canManageAdmins;
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Admin | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAdmins({ page, limit: 20, search: search || undefined });
      setAdmins(res.data ?? []);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const refreshPendingCount = useCallback(async () => {
    if (!canManageAdmins) return;
    try {
      setPendingCount((await getPendingAccessRequestCount()).count);
    } catch {
      // The badge is a hint; the Access requests tab reports its own load errors.
    }
  }, [canManageAdmins]);

  useEffect(() => {
    if (!canManageAdmins) return;
    listAdminRoles()
      .then(setRoles)
      .catch(() => setRoles([]));
  }, [canManageAdmins]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount for the tab badge
    void refreshPendingCount();
  }, [refreshPendingCount]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteAdmin(deleteTarget.id);
      setDeleteTarget(null);
      fetchAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  const activeCount = admins.filter((a) => a.user?.isActive).length;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Platform Administrators</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage platform administrators and their access permissions
        </p>
      </div>

      <Tabs defaultValue="admins" className="space-y-4">
        {canManageAdmins && (
          <TabsList>
            <TabsTrigger value="admins">Administrators</TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5">
              Access requests
              {pendingCount > 0 && (
                <span
                  aria-label={`${pendingCount} pending`}
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold text-white"
                >
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        )}
      <TabsContent value="admins" className="mt-0 space-y-4">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<ShieldCheckIcon className="h-5 w-5 text-blue-600" />} bg="bg-blue-100" label="Total Admins" value={total} sub="Across all levels" />
        <StatCard icon={<ShieldCheckIcon className="h-5 w-5 text-purple-600" />} bg="bg-purple-100" label="Active" value={activeCount} sub="Currently active" />
        <StatCard icon={<UserGroupIcon className="h-5 w-5 text-emerald-600" />} bg="bg-emerald-100" label="Loaded" value={admins.length} sub="On this page" />
        <StatCard icon={<UserGroupIcon className="h-5 w-5 text-amber-600" />} bg="bg-amber-100" label="Pages" value={totalPages} sub="Total pages" />
      </div>

      {/* Table Section */}
      <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Administrators</h2>
            <p className="mt-1 text-[11px] text-zinc-500">{total} total admins</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Invite Administrator
            </button>
            <button
              type="button"
              onClick={fetchAdmins}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchAdmins(); } }}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => { setPage(1); fetchAdmins(); }}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              <MagnifyingGlassIcon className="h-3.5 w-3.5" />
              Search
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full border-collapse text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Admin</th>
                <th className="px-3 py-2 font-semibold">Email</th>
                <th className="px-3 py-2 font-semibold">Role</th>
                <th className="px-3 py-2 font-semibold">Joined</th>
                <th className="px-3 py-2 text-right font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && admins.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                    No admins found.
                  </td>
                </tr>
              )}
              {!loading &&
                admins.map((admin, idx) => (
                  <tr key={admin.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                    <td className="px-3 py-2 font-semibold text-zinc-900">{admin.fullName}</td>
                    <td className="px-3 py-2 text-zinc-600">{admin.user?.email ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-700">
                      {admin.role?.name ?? "—"}
                      {extraCount(admin) > 0 && (
                        <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                          +{extraCount(admin)} extra
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {formatDate(admin.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-right">{statusBadge(admin.user?.isActive ?? false)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditTarget(admin)}
                          className="rounded-md border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm hover:bg-zinc-50 hover:text-zinc-700"
                          title="Edit admin"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                        </button>
                        {canSendPasswordLink(accessConfig, adminProfile?.id, admin.id, admin.user?.isActive ?? false) && (
                          <button
                            type="button"
                            onClick={() => setLinkTarget({ id: admin.id, fullName: admin.fullName })}
                            className="rounded-md border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm hover:bg-zinc-50 hover:text-zinc-700"
                            title="Send password link"
                            aria-label={`Send password link to ${admin.fullName}`}
                          >
                            <EnvelopeIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(admin)}
                          className="rounded-md border border-red-100 bg-white p-1 text-red-400 shadow-sm hover:bg-red-50 hover:text-red-600"
                          title="Delete admin"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-600">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
      </TabsContent>
      {canManageAdmins && (
        <TabsContent value="requests" className="mt-0">
          <AccessRequestsPanel onChanged={() => void refreshPendingCount()} />
        </TabsContent>
      )}
      </Tabs>

      {/* Modals */}
      {showCreate && (
        <InviteAdminDialog
          roles={roles}
          programs={invitePrograms}
          onClose={() => setShowCreate(false)}
          onInvited={fetchAdmins}
        />
      )}
      {editTarget && (
        <EditAdminModal
          admin={editTarget}
          roles={roles}
          programs={invitePrograms}
          onClose={() => setEditTarget(null)}
          onUpdated={fetchAdmins}
        />
      )}
      <SendPasswordLinkDialog target={linkTarget} onClose={() => setLinkTarget(null)} />
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete Admin?</h2>
            <p className="text-[11px] text-zinc-600">
              This will deactivate{" "}
              <span className="font-semibold">{deleteTarget.fullName}</span> and remove their access.
              This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-60"
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  bg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-600">{label}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
          <p className="mt-1 text-[10px] text-zinc-500">{sub}</p>
        </div>
        <div className={`rounded-full ${bg} p-2.5`}>{icon}</div>
      </div>
    </div>
  );
}
