"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, UserCheck, MailCheck, Loader2 } from "lucide-react";
import {
  listUsers,
  activateUser,
  deactivateUser,
  resendVerificationEmail,
  type User,
} from "@/src/shared/api-client";
import { getAdminAnalytics, type AdminAnalytics } from "@/src/shared/api-client";
import { useAuth } from "../../contexts/AuthContext";
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
  const brandId = adminProfile?.assignedBrands?.[0]?.brandId ?? undefined;
  const brandSlug = adminProfile?.assignedBrands?.[0]?.brandSlug ?? "";

  const [users, setUsers] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const skip = (page - 1) * limit;
      const [usersRes, analyticsRes] = await Promise.all([
        listUsers({ brandId, skip, take: limit, role: roleFilter || undefined }),
        getAdminAnalytics(brandId),
      ]);
      setUsers(usersRes);
      setAnalytics(analyticsRes);
      setHasMore(usersRes.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, brandId, roleFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    setPage(1);
  };

  const handleActivateDeactivate = async (user: User) => {
    if (!brandId) return;
    if (user.isActive) {
      if (!window.confirm(`Deactivate ${user.email}?`)) return;
    }

    setActionLoadingId(user.id);
    setActionMessage(null);
    try {
      if (user.isActive) {
        await deactivateUser(user.id, brandId);
      } else {
        await activateUser(user.id, brandId);
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u)),
      );
      setActionMessage({ id: user.id, text: user.isActive ? "Deactivated" : "Activated", ok: true });
    } catch (err) {
      setActionMessage({
        id: user.id,
        text: err instanceof Error ? err.message : "Action failed",
        ok: false,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResendVerification = async (user: User) => {
    setActionLoadingId(user.id);
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
    }
  };

  const verifiedCount = users.filter((u) => u.emailVerified).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Users"
        description="Manage all users and participants across the platform"
        actions={
          <Button variant="outline" size="sm" onClick={fetchData} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Users"
          value={loading ? "..." : (analytics?.users.total ?? 0)}
          description="All registered accounts"
          icon={Users}
        />
        <StatCard
          title="Active"
          value={loading ? "..." : (analytics?.users.active ?? 0)}
          description="Active accounts"
          icon={UserCheck}
        />
        <StatCard
          title="New This Month"
          value={loading ? "..." : (analytics?.users.new_this_month ?? 0)}
          description="Joined this month"
          icon={Users}
        />
        <StatCard
          title="Verified"
          value={verifiedCount}
          description="Email verified (this page)"
          icon={MailCheck}
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
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActing}
                          onClick={() => handleActivateDeactivate(user)}
                        >
                          {isActing ? (
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
                          {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resend"}
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
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
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
