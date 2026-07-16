"use client";

import React, { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/src/ui/button";

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
    <Button variant="outline" size="sm" onClick={handleSendEmail} disabled={isSending}>
      <Mail className="h-3.5 w-3.5" />
      {isSending ? "Sending..." : "Send Email"}
    </Button>
  );
}
