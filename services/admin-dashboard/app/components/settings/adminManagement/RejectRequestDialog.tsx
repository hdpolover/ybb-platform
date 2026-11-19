// services/admin-dashboard/app/components/settings/adminManagement/RejectRequestDialog.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import { Button } from "@/src/ui/button";
import { rejectAccessRequest, type AccessRequest } from "@/src/shared/api-client";

export function RejectRequestDialog({
  request,
  onClose,
  onRejected,
}: {
  request: AccessRequest;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReject() {
    setPending(true);
    setError(null);
    try {
      await rejectAccessRequest(request.id, reason.trim() || undefined);
      toast.success("Request rejected.");
      onRejected();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject the request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject request from {request.fullName}?</DialogTitle>
          <DialogDescription>{request.email}</DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor="reject-reason" className="mb-1 block text-sm font-medium text-zinc-700">
            Reason <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </div>
        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={() => void handleReject()} loading={pending}>
            Reject request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
