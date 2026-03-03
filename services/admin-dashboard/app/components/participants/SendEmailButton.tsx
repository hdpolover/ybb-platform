"use client";

import React, { useState } from "react";
import { Button } from "@/app/components/ui/Button";

export function SendEmailButton({ email }: { email: string }) {
  const [isSending, setIsSending] = useState(false);

  const handleSendEmail = async () => {
    setIsSending(true);
    // Simulasi API Call
    setTimeout(() => {
      alert(`Email sent to ${email}`);
      setIsSending(false);
    }, 1000);
  };

  return (
    <Button variant="blue" size="sm" onClick={handleSendEmail} disabled={isSending}>
      {isSending ? "Sending..." : "Send Email"}
    </Button>
  );
}