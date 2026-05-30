"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Eye, Pencil, RefreshCw, Search, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  activateAmbassador,
  createAmbassador,
  deactivateAmbassador,
  deleteAmbassador,
  listAmbassadors,
  updateAmbassador,
  type Ambassador,
} from "@/src/shared/api-client";
import { PageHeader } from "@/src/admin/page-header";
import { StatusBadge } from "@/src/admin/status-badge";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { EnglishInput } from "@/src/ui/english-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/src/ui/sheet";

export default function AmbassadorsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();

  const resolvedProgramId = useMemo(() => {
    const match = accessiblePrograms.find(
      (item) => item.programId === params.programId || item.programSlug === params.programId,
    );
    return match?.programId ?? params.programId;
  }, [accessiblePrograms, params.programId]);

  const [items, setItems] = useState<Ambassador[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, lastPage: 1 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Ambassador | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ambassador | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    fullName: "",
    phoneNumber: "",
    institution: "",
    gender: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await listAmbassadors({
        programId: resolvedProgramId,
        search: search || undefined,
        page,
        limit: 20,
      });
      setItems(response.data);
      setMeta(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ambassadors");
    } finally {
      setLoading(false);
    }
  }, [page, resolvedProgramId, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const activeCount = items.filter((item) => item.isActive).length;
  const totalConverted = items.reduce((sum, item) => sum + item.successfulReferrals, 0);

  function openCreate() {
    setEditTarget(null);
    setForm({
      email: "",
      fullName: "",
      phoneNumber: "",
      institution: "",
      gender: "",
      notes: "",
    });
    setFormError(null);
    setSheetOpen(true);
  }

  function openEdit(ambassador: Ambassador) {
    setEditTarget(ambassador);
    setForm({
      email: ambassador.user?.email ?? "",
      fullName: ambassador.fullName,
      phoneNumber: ambassador.phoneNumber ?? "",
      institution: ambassador.institution ?? "",
      gender: ambassador.gender ?? "",
      notes: ambassador.notes ?? "",
    });
    setFormError(null);
    setSheetOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      if (editTarget) {
        await updateAmbassador(editTarget.id, {
          fullName: form.fullName || undefined,
          phoneNumber: form.phoneNumber || undefined,
          institution: form.institution || undefined,
          gender: form.gender || undefined,
          notes: form.notes || undefined,
        });
      } else {
        await createAmbassador({
          email: form.email,
          fullName: form.fullName,
          programId: resolvedProgramId,
          phoneNumber: form.phoneNumber || undefined,
          institution: form.institution || undefined,
          gender: form.gender || undefined,
          notes: form.notes || undefined,
        });
      }
      setSheetOpen(false);
      void fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(ambassador: Ambassador) {
    try {
      if (ambassador.isActive) {
        await deactivateAmbassador(ambassador.id);
      } else {
        await activateAmbassador(ambassador.id);
      }
      void fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAmbassador(deleteTarget.id);
      setDeleteTarget(null);
      void fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ambassador");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ambassadors"
        description="Manage ambassadors, review referrals, and open detail pages for audit."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Add Ambassador
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Total Ambassadors</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-semibold text-zinc-900">
            {loading ? "—" : meta.total}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Active</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-semibold text-emerald-600">
            {loading ? "—" : activeCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Converted Referrals</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-semibold text-blue-600">
            {loading ? "—" : totalConverted}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Search by name, code, or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-8 pl-8 text-sm"
            />
          </div>
          <span className="text-xs text-zinc-400">
            {loading ? "Loading…" : `${items.length} result${items.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ambassador</TableHead>
              <TableHead>Referral Code</TableHead>
              <TableHead>Referrals</TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-zinc-400">
                  Loading ambassadors…
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-zinc-400">
                  No ambassadors found.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.map((ambassador) => (
                <TableRow key={ambassador.id}>
                  <TableCell>
                    <div className="font-medium text-zinc-900">{ambassador.fullName}</div>
                    <div className="text-xs text-zinc-500">{ambassador.user?.email ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs">
                      {ambassador.referralCode}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-zinc-900">{ambassador.totalReferrals}</div>
                    <div className="text-xs text-zinc-500">
                      {ambassador.successfulReferrals} converted
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">
                    {ambassador.institution ?? "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(ambassador)}
                      className="rounded-full"
                    >
                      <StatusBadge
                        status={ambassador.isActive ? "active" : "inactive"}
                        context="generic"
                      />
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/programs/${params.programId}/ambassadors/${ambassador.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(ambassador)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setDeleteTarget(ambassador)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {meta.lastPage > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <span className="text-xs text-zinc-500">
              Page {page} of {meta.lastPage}
            </span>
            <Button variant="outline" size="sm" disabled={page >= meta.lastPage} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="shrink-0 border-b border-zinc-200 px-6 py-4">
            <SheetTitle>{editTarget ? "Edit Ambassador" : "Add Ambassador"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {formError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>
            )}

            {!editTarget && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <EnglishInput
                type="text"
                restrictMode="name"
                value={form.fullName}
                onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Phone</label>
                <Input
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((current) => ({ ...current, phoneNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Gender</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm((current) => ({ ...current, gender: e.target.value }))}
                  className="block h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">— Select —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Institution</label>
              <Input
                type="text"
                value={form.institution}
                onChange={(e) => setForm((current) => ({ ...current, institution: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Notes</label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                className="block w-full resize-none rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 px-6 py-4">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} loading={saving}>
              {editTarget ? "Save Changes" : "Create Ambassador"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Ambassador"
        description={`Remove ${deleteTarget?.fullName} as an ambassador? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
