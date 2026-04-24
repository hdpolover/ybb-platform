"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  ShieldCheck,
  Calendar,
  UserCircle,
  Loader2,
  RefreshCw,
  SendHorizonal,
} from "lucide-react";
import {
  getUser,
  activateUser,
  deactivateUser,
  resendVerificationEmail,
  type User,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { PageHeader } from "@/src/admin/page-header";
import { StatusBadge } from "@/src/admin/status-badge";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { Button } from "@/src/ui/button";
import { Badge } from "@/src/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";

const ROLE_BADGE_VARIANT: Record<string, "info" | "purple" | "secondary"> = {
  participant: "info",
  ambassador: "purple",
  none: "secondary",
};

// ─── Field row ────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-zinc-100 last:border-0">
      <span className="w-40 shrink-0 text-sm text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-900 flex-1">{children}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ programId: string; userId: string }>;
}) {
  const { programId, userId } = use(params);
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

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState<"toggle" | "resend" | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  async function fetchUser() {
    setLoading(true);
    setError(null);
    try {
      const data = await getUser(userId, brandId || undefined);
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, brandId]);

  async function handleToggle() {
    if (!user || !brandId) return;
    setActionLoading(true);
    setActionType("toggle");
    setToast(null);
    try {
      if (user.isActive) {
        await deactivateUser(user.id, brandId);
        setUser((u) => u ? { ...u, isActive: false } : u);
        setToast({ text: "User deactivated", ok: true });
      } else {
        await activateUser(user.id, brandId);
        setUser((u) => u ? { ...u, isActive: true } : u);
        setToast({ text: "User activated", ok: true });
      }
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : "Action failed", ok: false });
    } finally {
      setActionLoading(false);
      setActionType(null);
      setConfirmDeactivate(false);
    }
  }

  async function handleResend() {
    if (!user || !brandSlug) return;
    setActionLoading(true);
    setActionType("resend");
    setToast(null);
    try {
      await resendVerificationEmail(user.email, brandSlug);
      setToast({ text: "Verification email sent", ok: true });
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : "Failed to send", ok: false });
    } finally {
      setActionLoading(false);
      setActionType(null);
    }
  }

  const role = user?.role ?? "none";

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Detail"
        description={user?.email ?? "Loading…"}
        breadcrumb={
          <Link
            href={`/programs/${programId}/users`}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Users
          </Link>
        }
        actions={
          <Button variant="outline" size="sm" onClick={fetchUser} disabled={loading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.text}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
        </div>
      )}

      {!loading && user && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-zinc-400" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Field label="Email">
                  <span className="font-mono text-sm">{user.email}</span>
                </Field>
                <Field label="Role">
                  <Badge
                    variant={ROLE_BADGE_VARIANT[role] ?? "secondary"}
                    className="capitalize"
                  >
                    {role}
                  </Badge>
                </Field>
                <Field label="Account Status">
                  <StatusBadge
                    status={user.isActive ? "active" : "inactive"}
                    context="generic"
                  />
                </Field>
                <Field label="Email Verified">
                  {user.emailVerified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-sm">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="text-amber-600 font-medium text-sm">Not verified</span>
                  )}
                </Field>
                <Field label="Joined">
                  <span className="flex items-center gap-1 text-zinc-600">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </Field>
                <Field label="Last Updated">
                  {new Date(user.updatedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Field>
                <Field label="User ID">
                  <span className="font-mono text-xs text-zinc-400">{user.id}</span>
                </Field>
              </CardContent>
            </Card>

            {role === "participant" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Participant Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-500 mb-3">
                    This user is a program participant. View their full profile and application details.
                  </p>
                  <Link
                    href={`/programs/${programId}/participants`}
                    className="inline-flex h-8 items-center rounded border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                  >
                    View Participants List
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Actions sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Account Status</p>
                  {user.isActive ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      disabled={actionLoading}
                      onClick={() => setConfirmDeactivate(true)}
                    >
                      {actionLoading && actionType === "toggle" ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Deactivate Account
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full"
                      disabled={actionLoading}
                      onClick={handleToggle}
                    >
                      {actionLoading && actionType === "toggle" ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Activate Account
                    </Button>
                  )}
                </div>

                <div>
                  <p className="text-xs text-zinc-500 mb-2">Email Verification</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={actionLoading || user.emailVerified}
                    onClick={handleResend}
                    title={user.emailVerified ? "Email already verified" : "Send verification email"}
                  >
                    {actionLoading && actionType === "resend" ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-3.5 w-3.5" />
                    )}
                    {user.emailVerified ? "Already Verified" : "Resend Verification"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title="Deactivate User"
        description={`Deactivate ${user?.email}? They will lose access until reactivated.`}
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={handleToggle}
      />
    </div>
  );
}
