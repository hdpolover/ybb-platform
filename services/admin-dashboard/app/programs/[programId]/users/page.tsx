"use client";

import { use, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Eye, Loader2, RefreshCw } from "lucide-react";
import {
  listUsers,
  createUser,
  resendVerificationEmail,
  type User,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { PageHeader } from "@/src/admin/page-header";
import { StatusBadge } from "@/src/admin/status-badge";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Badge } from "@/src/ui/badge";
import { Label } from "@/src/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";

const ROLE_OPTIONS = [
  { value: "", label: "All Users" },
  { value: "participant", label: "Participant" },
  { value: "ambassador", label: "Ambassador" },
  { value: "none", label: "No Role" },
];

const ROLE_BADGE_VARIANT: Record<string, "info" | "purple" | "secondary"> = {
  participant: "info",
  ambassador: "purple",
  none: "secondary",
};

const PAGE_SIZE = 20;

// ─── Create User Dialog ───────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onOpenChange,
  brandId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brandId: string;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEmail("");
    setPassword("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createUser({ brandId, email: email.trim(), password });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cu-email">Email</Label>
            <Input
              id="cu-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Password</Label>
            <Input
              id="cu-password"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { reset(); onOpenChange(false); }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={loading}>
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms, adminProfile } = useAuth();

  const program = useMemo(
    () =>
      accessiblePrograms.find(
        (p) => p.programId === programId || p.programSlug === programId,
      ),
    [accessiblePrograms, programId],
  );
  const brandId = program?.brandId ?? adminProfile?.assignedBrands?.[0]?.brandId ?? "";
  const brandSlug = program?.brandSlug ?? adminProfile?.assignedBrands?.[0]?.brandSlug ?? "";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resendLoadingId, setResendLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const skip = (page - 1) * PAGE_SIZE;
      const res = await listUsers({
        brandId,
        skip,
        take: PAGE_SIZE,
        role: roleFilter || undefined,
      });
      // exclude admin role — admins have a separate management section
      const nonAdmins = res.filter((u) => u.role !== "admin");
      setUsers(nonAdmins);
      setHasMore(res.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [brandId, page, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const visibleUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter((u) => u.email.toLowerCase().includes(q));
  }, [users, search]);

  async function handleResend(user: User) {
    if (!brandSlug) {
      setToast({ id: user.id, text: "No brand context", ok: false });
      return;
    }
    setResendLoadingId(user.id);
    setToast(null);
    try {
      await resendVerificationEmail(user.email, brandSlug);
      setToast({ id: user.id, text: "Verification email sent", ok: true });
    } catch (err) {
      setToast({ id: user.id, text: err instanceof Error ? err.message : "Failed", ok: false });
    } finally {
      setResendLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`Participants and ambassadors${program ? ` in ${program.programName}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!brandId}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create User
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Search by email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); setToast(null); }}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 h-8"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-400">
            {visibleUsers.length} result{visibleUsers.length !== 1 ? "s" : ""}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email Verified</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-zinc-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!loading && visibleUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-zinc-400">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {!loading && visibleUsers.map((user) => {
              const isSending = resendLoadingId === user.id;
              const msg = toast?.id === user.id ? toast : null;
              const role = user.role ?? "none";
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{user.email}</span>
                      {msg && (
                        <span className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>
                          {msg.text}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_BADGE_VARIANT[role] ?? "secondary"} className="capitalize">
                      {role}
                    </Badge>
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
                  <TableCell className="text-sm text-zinc-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/programs/${programId}/users/${user.id}`}
                        className="inline-flex h-8 items-center gap-1 rounded px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSending || user.emailVerified}
                        title={user.emailVerified ? "Already verified" : "Resend verification email"}
                        onClick={() => handleResend(user)}
                      >
                        {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resend"}
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
                onClick={() => { setToast(null); setPage((p) => p - 1); }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => { setToast(null); setPage((p) => p + 1); }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        brandId={brandId}
        onCreated={fetchUsers}
      />
    </div>
  );
}
