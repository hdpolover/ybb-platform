// services/admin-dashboard/app/components/settings/adminManagement/SendPasswordLinkDialog.tsx
"use client";

import { toast } from "sonner";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { sendAdminPasswordLink } from "@/src/shared/api-client";

export type PasswordLinkTarget = { id: string; fullName: string };

export function SendPasswordLinkDialog({
  target,
  onClose,
}: {
  target: PasswordLinkTarget | null;
  onClose: () => void;
}) {
  async function handleConfirm() {
    if (!target) return;
    try {
      await sendAdminPasswordLink(target.id);
      toast.success("Password link sent.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send the password link.");
    }
  }

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Send password link to ${target?.fullName ?? ""}?`}
      description="This logs them out everywhere, disables their current password and emails a link to set a new one (expires in 72 hours)."
      confirmLabel="Send link"
      variant="destructive"
      onConfirm={handleConfirm}
    />
  );
}
