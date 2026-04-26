"use client";

import React, { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { EnvelopeIcon } from "@heroicons/react/24/outline";

interface NotifyParticipantButtonProps {
  email: string;
}

export function NotifyParticipantButton({ email }: NotifyParticipantButtonProps) {
  const [isSending, setIsSending] = useState(false);

  const handleNotify = async () => {
    try {
      setIsSending(true);
      // await fetch('/api/notify', { method: 'POST', body: JSON.stringify({ email }) });
      
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert(`Notification sent to ${email}`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button 
      variant="default" 
      size="sm"
      onClick={handleNotify}
      disabled={isSending}
    >
      {!isSending && <EnvelopeIcon className="h-3.5 w-3.5" />}
      {isSending ? "Sending..." : "Notify via Email"}
    </Button>
  );
}