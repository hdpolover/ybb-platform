// app/platform/error.tsx
"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/src/ui/button";

// Route-segment error boundary for the admin dashboard. Rendered inside AdminShell,
// so the nav stays intact and only the page content is replaced when a page throws.
export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Platform route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-zinc-900">Something went wrong</h2>
      <p className="mt-1 max-w-md text-sm text-zinc-500">
        This section failed to load. The rest of the dashboard is still available.
        {error.digest ? ` (ref: ${error.digest})` : ""}
      </p>
      <Button onClick={reset} className="mt-5">
        Try again
      </Button>
    </div>
  );
}
