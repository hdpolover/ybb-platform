"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";

interface DrawerShellProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Error banner rendered inside the scroll area above the form body. */
  error?: string | null;
  /** Main form/content — rendered in a vertical-scroll area between sticky header and footer. */
  children: ReactNode;
  /** Footer buttons. Typically a Cancel + primary Save pair. */
  footer: ReactNode;
  /** Drawer width. `sm:max-w-2xl` by default — override for longer forms. */
  width?: string;
  /** Disable the close-on-outside-click behavior while an action is in progress. */
  locked?: boolean;
}

/**
 * Reusable right-side drawer skeleton for create/edit forms. All the CRUD
 * drawers in the admin dashboard share the same shape — sticky header + a
 * scrollable body + sticky footer with Cancel/Save — so this wrapper owns
 * that layout and each caller only focuses on the form itself.
 *
 * Not appropriate for confirmations, pickers, or view-only content — use
 * Dialog primitives from `@/src/ui/dialog` for those.
 */
export function DrawerShell({
  open,
  onClose,
  title,
  description,
  error,
  children,
  footer,
  width = "sm:max-w-2xl",
  locked = false,
}: DrawerShellProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && !locked && onClose()}>
      <SheetContent side="right" className={`w-full ${width} overflow-y-auto p-0`}>
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        <div className="space-y-6 px-6 py-6">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          {children}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-4">
          {footer}
        </div>
      </SheetContent>
    </Sheet>
  );
}
