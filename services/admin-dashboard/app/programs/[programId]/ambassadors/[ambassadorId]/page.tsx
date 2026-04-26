"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, RefreshCw, TrendingUp, Users, UserRound, Clock3, ExternalLink } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { PageHeader } from "@/src/admin/page-header";
import { StatusBadge } from "@/src/admin/status-badge";
import { Button } from "@/src/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";
import { getAmbassador, getAmbassadorReferrals, type AmbassadorDetail, type AmbassadorReferral } from "@/src/shared/api-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b border-zinc-100 py-3 last:border-0">
      <span className="w-40 shrink-0 text-sm text-zinc-500">{label}</span>
      <div className="flex-1 text-sm text-zinc-900">{children}</div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDuration(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value} day${value === 1 ? "" : "s"}`;
}

export default function AmbassadorDetailPage({
  params,
}: {
  params: Promise<{ programId: string; ambassadorId: string }>;
}) {
  const { programId, ambassadorId } = use(params);
  const { accessiblePrograms } = useAuth();

  const program = useMemo(
    () => accessiblePrograms.find((item) => item.programId === programId || item.programSlug === programId),
    [accessiblePrograms, programId],
  );

  const [ambassador, setAmbassador] = useState<AmbassadorDetail | null>(null);
  const [referrals, setReferrals] = useState<AmbassadorReferral[]>([]);
  const [referralMeta, setReferralMeta] = useState({ total: 0, page: 1, limit: 20, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [referralLoading, setReferralLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"link" | "code" | null>(null);

  const loadAmbassador = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAmbassador(ambassadorId);
      setAmbassador(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ambassador detail");
    } finally {
      setLoading(false);
    }
  }, [ambassadorId]);

  const loadReferrals = useCallback(async (page = 1) => {
    setReferralLoading(true);
    try {
      const response = await getAmbassadorReferrals(ambassadorId, page);
      setReferrals(response.data);
      setReferralMeta(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ambassador referrals");
    } finally {
      setReferralLoading(false);
    }
  }, [ambassadorId]);

  useEffect(() => {
    void loadAmbassador();
    void loadReferrals();
  }, [loadAmbassador, loadReferrals]);

  const stageCounts = ambassador?.analytics?.statusCounts ?? {
    referred: 0,
    registered: 0,
    applied: 0,
    accepted: 0,
    completed: 0,
  };

  const avgConversionDays = ambassador?.analytics?.averageConversionDays ?? null;

  const handleCopy = async (type: "link" | "code", value?: string | null) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopyState(type);
    window.setTimeout(() => setCopyState(null), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ambassador Detail"
        description={ambassador?.fullName ?? "Audit ambassador performance and referral history"}
        breadcrumb={
          <Link
            href={`/programs/${programId}/ambassadors`}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Ambassadors
          </Link>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => { void loadAmbassador(); void loadReferrals(referralMeta.page); }} disabled={loading || referralLoading}>
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

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-400">
          Loading ambassador detail…
        </div>
      ) : ambassador ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Total Referrals</CardDescription>
                <CardTitle className="text-2xl">{ambassador.totalReferrals}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Successful Referrals</CardDescription>
                <CardTitle className="text-2xl text-emerald-600">{ambassador.successfulReferrals}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Conversion Rate</CardDescription>
                <CardTitle className="text-2xl">
                  {ambassador.totalReferrals > 0 ? Math.round((ambassador.successfulReferrals / ambassador.totalReferrals) * 100) : 0}%
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Avg. Conversion Time</CardDescription>
                <CardTitle className="text-2xl">{avgConversionDays !== null ? `${avgConversionDays}d` : "—"}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ambassador Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <Field label="Full Name">{ambassador.fullName}</Field>
                  <Field label="Email">{ambassador.user?.email ?? "—"}</Field>
                  <Field label="Program">{ambassador.programName ?? program?.programName ?? "—"}</Field>
                  <Field label="Institution">{ambassador.institution ?? "—"}</Field>
                  <Field label="Phone">{ambassador.phoneNumber ?? "—"}</Field>
                  <Field label="Status">
                    <StatusBadge status={ambassador.isActive ? "active" : "inactive"} context="generic" />
                  </Field>
                  <Field label="Referral Code">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs">{ambassador.referralCode}</code>
                      <Button variant="outline" size="sm" onClick={() => void handleCopy("code", ambassador.referralCode)}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        {copyState === "code" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </Field>
                  <Field label="Share Link">
                    <div className="flex flex-col gap-2">
                      <code className="block w-full truncate rounded bg-zinc-100 px-2 py-1 font-mono text-xs">
                        {ambassador.shareLink ?? "—"}
                      </code>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => void handleCopy("link", ambassador.shareLink)}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          {copyState === "link" ? "Copied" : "Copy"}
                        </Button>
                        {ambassador.shareLink ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={ambassador.shareLink} target="_blank" rel="noreferrer noopener">
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Open
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </Field>
                  <Field label="Activated">{formatDate(ambassador.activatedAt)}</Field>
                  <Field label="Created">{formatDate(ambassador.createdAt)}</Field>
                  <Field label="Notes">{ambassador.notes?.trim() || "—"}</Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Referred Participants</CardTitle>
                  <CardDescription>Audit the participant funnel linked to this ambassador.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-5">
                    {[
                      { label: "Referred", value: stageCounts.referred },
                      { label: "Registered", value: stageCounts.registered },
                      { label: "Applied", value: stageCounts.applied },
                      { label: "Accepted", value: stageCounts.accepted },
                      { label: "Completed", value: stageCounts.completed },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{item.label}</div>
                        <div className="mt-1 text-lg font-semibold text-zinc-900">{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Participant</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Referred</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>Cycle Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referralLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-zinc-400">
                            Loading referrals…
                          </TableCell>
                        </TableRow>
                      ) : referrals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-zinc-400">
                            No referrals recorded for this ambassador yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        referrals.map((referral) => (
                          <TableRow key={referral.id}>
                            <TableCell>
                              <div className="font-medium text-zinc-900">{referral.participantName || "Participant"}</div>
                              <div className="text-xs text-zinc-500">{referral.participantEmail || "No email"}</div>
                              <div className="text-xs text-zinc-400">{referral.participantId}</div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={referral.status} context="generic" />
                            </TableCell>
                            <TableCell>{formatDate(referral.referredAt)}</TableCell>
                            <TableCell>{formatDate(referral.appliedAt)}</TableCell>
                            <TableCell>{formatDate(referral.completedAt)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm text-zinc-700">
                                <Clock3 className="h-3.5 w-3.5 text-zinc-400" />
                                {formatDuration(referral.totalConversionDays ?? referral.daysToAccept ?? referral.daysToApply ?? referral.daysToRegister)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {referralMeta.lastPage > 1 ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={referralMeta.page <= 1} onClick={() => void loadReferrals(referralMeta.page - 1)}>
                        Previous
                      </Button>
                      <span className="text-xs text-zinc-500">
                        Page {referralMeta.page} of {referralMeta.lastPage}
                      </span>
                      <Button variant="outline" size="sm" disabled={referralMeta.page >= referralMeta.lastPage} onClick={() => void loadReferrals(referralMeta.page + 1)}>
                        Next
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Audit Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-zinc-700">
                  <div className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
                    <Users className="h-4 w-4 text-zinc-400" />
                    <div>
                      <div className="font-medium text-zinc-900">{ambassador.totalReferrals}</div>
                      <div className="text-xs text-zinc-500">Total participants attributed</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <div>
                      <div className="font-medium text-zinc-900">{ambassador.successfulReferrals}</div>
                      <div className="text-xs text-zinc-500">Accepted conversions</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
                    <UserRound className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="font-medium text-zinc-900">{stageCounts.completed}</div>
                      <div className="text-xs text-zinc-500">Completed referrals</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
