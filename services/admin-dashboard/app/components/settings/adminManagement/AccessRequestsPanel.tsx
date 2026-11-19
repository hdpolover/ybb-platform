// services/admin-dashboard/app/components/settings/adminManagement/AccessRequestsPanel.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { Badge } from "@/src/ui/badge";
import { Button } from "@/src/ui/button";
import { Select } from "@/src/ui/select";
import { EmptyState } from "@/src/admin/empty-state";
import { canSendPasswordLink } from "@/lib/access-requests";
import { formatDateTime } from "@/lib/utils";
import {
  listAccessRequests,
  listAdminRoles,
  type AccessRequest,
  type AccessRequestStatus,
  type AdminRole,
} from "@/src/shared/api-client";
import { ApproveRequestDialog } from "./ApproveRequestDialog";
import { RejectRequestDialog } from "./RejectRequestDialog";
import { SendPasswordLinkDialog, type PasswordLinkTarget } from "./SendPasswordLinkDialog";

const STATUS_BADGE: Record<AccessRequestStatus, "pending" | "success" | "secondary"> = {
  pending: "pending",
  approved: "success",
  rejected: "secondary",
};

export function AccessRequestsPanel({ onChanged }: { onChanged: () => void }) {
  const { adminProfile, accessiblePrograms, accessConfig } = useAuth();
  const [status, setStatus] = useState<AccessRequestStatus>("pending");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<AccessRequest | null>(null);
  const [rejecting, setRejecting] = useState<AccessRequest | null>(null);
  const [linkTarget, setLinkTarget] = useState<PasswordLinkTarget | null>(null);

  const programs = useMemo(
    () =>
      accessiblePrograms.map((p) => ({ id: p.programId, name: p.programName, brandName: p.brandName })),
    [accessiblePrograms],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await listAccessRequests(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load access requests.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listAdminRoles()
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  const refreshAll = () => {
    void load();
    onChanged();
  };

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-4 shadow-sm md:px-5">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Access requests</h2>
          <p className="mt-1 text-xs text-zinc-500">
            People who asked for an admin account through the public request form.
          </p>
        </div>
        <div className="w-full sm:w-48">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AccessRequestStatus)}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-10 text-center text-xs text-zinc-500">Loading requests...</p>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={`No ${status} requests`}
          description={status === "pending" ? "New requests show up here for review." : undefined}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-y border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2">Requester</th>
                <th className="px-3 py-2">Division</th>
                <th className="px-3 py-2">Programs</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Requested</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-zinc-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-zinc-900">{req.fullName}</div>
                    <div className="text-[11px] text-zinc-500">{req.email}</div>
                    {req.whatsapp ? <div className="text-[11px] text-zinc-500">{req.whatsapp}</div> : null}
                    {req.note ? <div className="mt-1 max-w-xs text-[11px] italic text-zinc-500">{req.note}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {req.divisionLabel}
                    {req.defaultRoleName ? (
                      <div className="text-[11px] text-zinc-500">Suggested: {req.defaultRoleName}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {req.requestedPrograms.map((p) => (
                        <Badge key={p.id} variant="info" className="text-[10px] font-medium">
                          {p.name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_BADGE[req.status]} className="capitalize">
                      {req.status}
                    </Badge>
                    {req.status !== "pending" && req.reviewedByName ? (
                      <div className="mt-1 text-[11px] text-zinc-500">by {req.reviewedByName}</div>
                    ) : null}
                    {req.rejectReason ? (
                      <div className="mt-1 max-w-[12rem] text-[11px] text-zinc-500">{req.rejectReason}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{formatDateTime(req.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <RowActions
                        req={req}
                        canSendLink={
                          req.existingAdminId !== null &&
                          canSendPasswordLink(accessConfig, adminProfile?.id, req.existingAdminId)
                        }
                        onApprove={() => setApproving(req)}
                        onReject={() => setRejecting(req)}
                        onSendLink={() =>
                          req.existingAdminId &&
                          setLinkTarget({ id: req.existingAdminId, fullName: req.fullName })
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approving ? (
        <ApproveRequestDialog
          request={approving}
          roles={roles}
          programs={programs}
          onClose={() => setApproving(null)}
          onApproved={refreshAll}
        />
      ) : null}
      {rejecting ? (
        <RejectRequestDialog request={rejecting} onClose={() => setRejecting(null)} onRejected={refreshAll} />
      ) : null}
      <SendPasswordLinkDialog target={linkTarget} onClose={() => setLinkTarget(null)} />
    </section>
  );
}

function RowActions({
  req,
  canSendLink,
  onApprove,
  onReject,
  onSendLink,
}: {
  req: AccessRequest;
  canSendLink: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSendLink: () => void;
}) {
  if (req.existingAdminId) {
    return (
      <>
        <span className="text-[11px] font-medium text-zinc-500">Already an admin</span>
        {canSendLink ? (
          <Button size="sm" variant="outline" onClick={onSendLink}>
            Send password link
          </Button>
        ) : null}
      </>
    );
  }
  if (req.status !== "pending") return null;
  return (
    <>
      <Button size="sm" onClick={onApprove}>
        Approve
      </Button>
      <Button size="sm" variant="outline" onClick={onReject}>
        Reject
      </Button>
    </>
  );
}
