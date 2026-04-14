"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowPathIcon,
  UserGroupIcon,
  UserPlusIcon,
  UserMinusIcon,
} from "@heroicons/react/24/outline";
import { listUsers, type User } from "../../../src/shared/api-client";
import { useAuth } from "../../contexts/AuthContext";

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

function emailBadge(verified: boolean) {
  return verified ? (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      Unverified
    </span>
  );
}

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Platform Users</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage all users and participants across the platform
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<UserGroupIcon className="h-5 w-5 text-blue-600" />} bg="bg-blue-100" label="Loaded" value={users.length} sub="On this page" />
        <StatCard icon={<UserPlusIcon className="h-5 w-5 text-emerald-600" />} bg="bg-emerald-100" label="Active" value={activeCount} sub="Active accounts" />
        <StatCard icon={<UserPlusIcon className="h-5 w-5 text-purple-600" />} bg="bg-purple-100" label="Verified" value={verifiedCount} sub="Email verified" />
        <StatCard icon={<UserMinusIcon className="h-5 w-5 text-zinc-600" />} bg="bg-zinc-100" label="Inactive" value={users.length - activeCount} sub="Inactive accounts" />
      </div>

      {/* Table */}
      <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Users</h2>
            <p className="mt-1 text-[11px] text-zinc-500">Page {page}</p>
          </div>
          <button
            type="button"
            onClick={fetchUsers}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full border-collapse text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Email</th>
                <th className="px-3 py-2 font-semibold">Email Status</th>
                <th className="px-3 py-2 font-semibold">Account Status</th>
                <th className="px-3 py-2 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">Loading…</td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">No users found.</td>
                </tr>
              )}
              {!loading && users.map((user, idx) => (
                <tr key={user.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2 text-zinc-900">{user.email}</td>
                  <td className="px-3 py-2">{emailBadge(user.emailVerified)}</td>
                  <td className="px-3 py-2">{statusBadge(user.isActive)}</td>
                  <td className="px-3 py-2 text-zinc-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(page > 1 || hasMore) && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-600">
            <span>Page {page}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-zinc-200 px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
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
