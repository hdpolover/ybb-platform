"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, UserCheck, UserX, MailCheck } from "lucide-react";
import { listUsers, type User } from "../../../src/shared/api-client";
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

export default function UsersPage() {
  const { adminProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  const brandId = adminProfile?.assignedBrands?.[0]?.brandId ?? undefined;
  const activeCount = users.filter((u) => u.isActive).length;
  const verifiedCount = users.filter((u) => u.emailVerified).length;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const skip = (page - 1) * limit;
      const res = await listUsers({ brandId, skip, take: limit });
      setUsers(res);
      setHasMore(res.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, brandId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Users"
        description="Manage all users and participants across the platform"
        actions={
          <Button variant="outline" size="sm" onClick={fetchUsers} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Loaded" value={users.length} description="On this page" icon={Users} />
        <StatCard title="Active" value={activeCount} description="Active accounts" icon={UserCheck} />
        <StatCard title="Verified" value={verifiedCount} description="Email verified" icon={MailCheck} />
        <StatCard title="Inactive" value={users.length - activeCount} description="Inactive accounts" icon={UserX} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-900">Users — Page {page}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Email Status</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-zinc-400">Loading…</TableCell>
              </TableRow>
            )}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-zinc-400">No users found.</TableCell>
              </TableRow>
            )}
            {!loading && users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>
                  <StatusBadge status={user.emailVerified ? "verified" : "unverified"} context="generic" />
                </TableCell>
                <TableCell>
                  <StatusBadge status={user.isActive ? "active" : "inactive"} context="generic" />
                </TableCell>
                <TableCell className="text-zinc-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">
            <span>Page {page}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
