"use client";

import React, { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Receipt } from "lucide-react";
import { resendReceiptEmail } from "@/src/shared/api-client";
import { toast as sonnerToast } from "sonner";

interface SendReceiptEmailButtonProps {
  email: string;
  invoiceId: string;
}

export function SendReceiptEmailButton({ email, invoiceId }: SendReceiptEmailButtonProps) {
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      const result = await resendReceiptEmail(invoiceId);
      if (result.sent) {
        sonnerToast.success(`Receipt email sent to ${email}.`);
      } else {
        sonnerToast.error("No email was sent.");
      }
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Failed to send receipt email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      onClick={() => void handleSend()}
      loading={isSending}
    >
      {!isSending && <Receipt className="h-3.5 w-3.5" />}
      {isSending ? "Sending..." : "Send receipt email"}
    </Button>
  );
}
