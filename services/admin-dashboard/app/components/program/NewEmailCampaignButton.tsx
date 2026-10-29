// services/admin-dashboard/app/components/program/NewEmailCampaignButton.tsx
"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/src/ui/button";
import { ApiError, createProgramEmailCampaign } from "@/src/shared/api-client";

const HTTP_UNAVAILABLE = 503;
const HTTP_BAD_GATEWAY = 502;

export function campaignErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === HTTP_UNAVAILABLE) {
    return "Listmonk is not configured on this environment, so campaigns can't be created yet.";
  }
  if (err instanceof ApiError && err.status === HTTP_BAD_GATEWAY) {
    return `Listmonk rejected the request: ${err.message}`;
  }
  return err instanceof Error ? err.message : "Failed to create the email campaign.";
}

export function NewEmailCampaignButton({ programId }: { programId: string }) {
  const [creating, setCreating] = useState(false);

  async function handleClick() {
    // Open the tab synchronously: browsers block window.open after an await.
    const tab = window.open("about:blank", "_blank");
    setCreating(true);
    try {
      const { editUrl } = await createProgramEmailCampaign(programId);
      if (tab) {
        tab.opener = null;
        tab.location.href = editUrl;
      } else {
        window.open(editUrl, "_blank", "noopener,noreferrer");
      }
      toast.success("Draft campaign created. Opening it in Listmonk.");
    } catch (err) {
      tab?.close();
      toast.error(campaignErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" loading={creating} onClick={() => void handleClick()}>
      <ExternalLink className="mr-2 h-3.5 w-3.5" />
      New email campaign (opens Listmonk)
    </Button>
  );
}
