"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { sanitize, type RestrictMode } from "@/lib/text/restricted-input";

export interface EnglishInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Restrict mode:
   *  - "name"    : A-Za-z, space, hyphen, apostrophe, period only.
   *  - "general" : Printable ASCII + tab/newline. (default)
   */
  restrictMode?: RestrictMode;
}

/**
 * Drop-in replacement for <input type="text"> / <Input> that enforces
 * English-only character restrictions as the user types or pastes.
 *
 * Mutates e.target.value before calling the consumer onChange so that
 * state stored upstream always holds the cleaned value.
 */
const EnglishInput = React.forwardRef<HTMLInputElement, EnglishInputProps>(
  ({ className, type, restrictMode = "general", onChange, ...props }, ref) => {
    const [removedMessage, setRemovedMessage] = React.useState<string | null>(null);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      const { value: clean, removed } = sanitize(raw, restrictMode);

      if (removed.length > 0) {
        // Mutate the event so the consumer stores the cleaned value.
        Object.defineProperty(e, "target", {
          writable: false,
          value: { ...e.target, value: clean },
        });
        e.target.value = clean;

        const label =
          removed.length === 1
            ? `"${removed[0]}"`
            : `${removed.length} characters`;
        setRemovedMessage(`${label} removed — only English characters allowed`);

        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setRemovedMessage(null), 3000);
      } else {
        setRemovedMessage(null);
      }

      onChange?.(e);
    }

    return (
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            "flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-900 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          ref={ref}
          onChange={handleChange}
          {...props}
        />
        {removedMessage !== null && (
          <p
            aria-live="polite"
            role="alert"
            className="mt-1 text-[11px] font-medium text-amber-600"
          >
            {removedMessage}
          </p>
        )}
      </div>
    );
  },
);

EnglishInput.displayName = "EnglishInput";

export { EnglishInput };
