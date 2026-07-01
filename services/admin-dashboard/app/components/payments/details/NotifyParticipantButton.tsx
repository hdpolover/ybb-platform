"use client";

import React, { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Mail } from "lucide-react";
import { notifyPaymentIssue } from "@/src/shared/api-client";
import { toast as sonnerToast } from "sonner";

interface NotifyParticipantButtonProps {
  email: string;
  invoiceId: string;
}

export function NotifyParticipantButton({ email, invoiceId }: NotifyParticipantButtonProps) {
  const [isSending, setIsSending] = useState(false);

  const handleNotify = async () => {
    setIsSending(true);
    try {
      const result = await notifyPaymentIssue([invoiceId]);
      if (result.sent > 0) {
        sonnerToast.success(`Payment help email sent to ${email}.`);
      } else {
        const reason = result.skipped[0]?.reason ?? "No email was sent.";
        sonnerToast.error(reason);
      }
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      onClick={() => void handleNotify()}
      loading={isSending}
    >
      {!isSending && <Mail className="h-3.5 w-3.5" />}
      {isSending ? "Sending..." : "Send payment help email"}
    </Button>
  );
}
