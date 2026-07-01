// app/global-error.tsx
"use client";

import { useEffect } from "react";

// Last-resort boundary: fires when the root layout itself throws. It replaces the
// root layout, so it must render its own <html>/<body> and stay dependency-light.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h2 className="text-lg font-semibold text-zinc-900">Something went wrong</h2>
          <p className="mt-1 max-w-md text-sm text-zinc-500">
            The application encountered an unexpected error.
            {error.digest ? ` (ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
