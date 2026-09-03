"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, UserCheck, Loader2, Download } from "lucide-react";
import {
  listUsers,
  activateUser,
  deactivateUser,
  resendVerificationEmail,
  getAdminAnalytics,
  exportUsersExcel,
  type User,
  type AdminAnalytics,
} from "@/src/shared/api-client";
import { useAuth } from "../../contexts/AuthContext";
import { useAccessibleBrands } from "../../hooks/useAccessibleBrands";
import { PageHeader } from "@/src/admin/page-header";
import { StatCard } from "@/src/admin/stat-card";
import { StatusBadge } from "@/src/admin/status-badge";
import { Button } from "@/src/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";
import { formatDate } from "@/lib/utils";

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "admin", label: "Admin" },
  { value: "participant", label: "Participant" },
  { value: "ambassador", label: "Ambassador" },
];

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700",
  participant: "bg-green-100 text-green-700",
  ambassador: "bg-purple-100 text-purple-700",
  none: "bg-zinc-100 text-zinc-500",
};

export default function UsersPage() {
  const { adminProfile } = useAuth();
  // Was `assignedBrands?.[0]`, which confined a multi-brand admin to whichever
  // brand came back first with no way to reach the others, and left a
  // programme-scoped admin (no admin_brands rows) with no brand at all. See
  // useAccessibleBrands.
  const accessibleBrands = useAccessibleBrands();
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const activeBrand =
    accessibleBrands.find((b) => b.brandId === selectedBrandId) ?? accessibleBrands[0];
  const brandId = activeBrand?.brandId;
  const brandSlug = activeBrand?.brandSlug ?? "";

  const [users, setUsers] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionLoadingType, setActionLoadingType] = useState<"toggle" | "resend" | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const limit = 20;

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await getAdminAnalytics(brandId);
      setAnalytics(res);
    } catch {
      // analytics errors are non-critical; page error handles listUsers failures
    }
  }, [brandId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const fetchData = useCallback(async () => {
    // adminProfile loads async and the API requires a brandId for anything but
    // platform scope, so firing before it resolves 400s and flashes
    // "Failed to load users" before the retry succeeds.
    if (!adminProfile) return;
    setLoading(true);
    setError(null);
    try {
      const skip = (page - 1) * limit;
      const res = await listUsers({ brandId, skip, take: limit, role: roleFilter || undefined });
      setUsers(res);
      setHasMore(res.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, brandId, roleFilter, adminProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRoleFilterChange = (value: string) => {
    setActionMessage(null);
    setRoleFilter(value);
    setPage(1);
  };

  const handleExportUsers = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportUsersExcel();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleActivateDeactivate = async (user: User) => {
    if (!brandId) return;
    if (user.isActive) {
      if (!window.confirm(`Deactivate ${user.email}?`)) return;
    }

    const nextIsActive = !user.isActive;
    setActionLoadingId(user.id);
    setActionLoadingType("toggle");
    setActionMessage(null);
    try {
      if (user.isActive) {
        await deactivateUser(user.id, brandId);
      } else {
        await activateUser(user.id, brandId);
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: nextIsActive } : u)),
      );
      setActionMessage({ id: user.id, text: nextIsActive ? "Activated" : "Deactivated", ok: true });
    } catch (err) {
      setActionMessage({
        id: user.id,
        text: err instanceof Error ? err.message : "Action failed",
        ok: false,
      });
    } finally {
      setActionLoadingId(null);
      setActionLoadingType(null);
    }
  };

  const handleResendVerification = async (user: User) => {
    if (!brandSlug) {
      setActionMessage({ id: user.id, text: "No brand context — cannot send email", ok: false });
      return;
    }
    setActionLoadingId(user.id);
    setActionLoadingType("resend");
    setActionMessage(null);
    try {
      await resendVerificationEmail(user.email, brandSlug);
      setActionMessage({ id: user.id, text: "Verification email sent", ok: true });
    } catch (err) {
      setActionMessage({
        id: user.id,
        text: err instanceof Error ? err.message : "Failed to send email",
        ok: false,
      });
    } finally {
      setActionLoadingId(null);
      setActionLoadingType(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Users"
        description="Manage all users and participants across the platform"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExportUsers()}
              disabled={exporting}
              loading={exporting}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exporting…" : "Export Excel"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { void fetchAnalytics(); void fetchData(); }} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      {exportError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Export failed: {exportError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Users"
          value={analytics === null ? "..." : (analytics.users.total ?? 0)}
          description="All registered accounts"
          icon={Users}
        />
        <StatCard
          title="Active"
          value={analytics === null ? "..." : (analytics.users.active ?? 0)}
          description="Active accounts"
          icon={UserCheck}
        />
        <StatCard
          title="New This Month"
          value={analytics === null ? "..." : (analytics.users.new_this_month ?? 0)}
          description="Joined this month"
          icon={Users}
        />
        <StatCard
          title="Participants"
          value={analytics === null ? "..." : (analytics.participants.total ?? 0)}
          description="Accepted participants"
          icon={UserCheck}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-900">Users — Page {page}</p>
          <div className="flex items-center gap-2">
            {accessibleBrands.length > 1 && (
              <select
                value={brandId ?? ""}
                onChange={(e) => {
                  setSelectedBrandId(e.target.value);
                  setPage(1);
                }}
                aria-label="Brand"
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {accessibleBrands.map((brand) => (
                  <option key={brand.brandId} value={brand.brandId}>
                    {brand.brandName}
                  </option>
                ))}
              </select>
            )}
          <select
            value={roleFilter}
            onChange={(e) => handleRoleFilterChange(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email Status</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-zinc-400">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-zinc-400">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              users.map((user) => {
                const isActing = actionLoadingId === user.id;
                const msg = actionMessage?.id === user.id ? actionMessage : null;
                const role = user.role ?? "none";
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.email}
                      {msg && (
                        <span
                          className={`ml-2 text-xs ${msg.ok ? "text-emerald-600" : "text-red-500"}`}
                        >
                          {msg.text}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_BADGE[role] ?? ROLE_BADGE.none}`}
                      >
                        {role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={user.emailVerified ? "verified" : "unverified"}
                        context="generic"
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={user.isActive ? "active" : "inactive"}
                        context="generic"
                      />
                    </TableCell>
                    <TableCell className="text-zinc-500">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActing}
                          onClick={() => handleActivateDeactivate(user)}
                        >
                          {isActing && actionLoadingType === "toggle" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : user.isActive ? (
                            "Deactivate"
                          ) : (
                            "Activate"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActing || user.emailVerified}
                          title={user.emailVerified ? "Already verified" : "Resend verification email"}
                          onClick={() => handleResendVerification(user)}
                        >
                          {isActing && actionLoadingType === "resend" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Resend"
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>

        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">
            <span>Page {page}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => { setActionMessage(null); setPage((p) => p - 1); }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => { setActionMessage(null); setPage((p) => p + 1); }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
