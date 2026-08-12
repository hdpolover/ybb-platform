// services/admin-dashboard/app/components/scoring/KeyboardShortcutsHelp.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/src/ui/dialog";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "Tab / Shift+Tab", description: "Move between score inputs" },
  { keys: "Enter", description: "In a score input: jump to the next criterion. On the last criterion, submits if every criterion is filled." },
  { keys: "Cmd+Enter / Ctrl+Enter", description: "Submit and advance to the next applicant, from anywhere on the page" },
  { keys: "Shift+→", description: "Next applicant" },
  { keys: "Shift+←", description: "Previous applicant" },
  { keys: "?", description: "Open this help" },
  { keys: "Esc", description: "Close this help" },
];

/**
 * Keyboard shortcuts reference for the review queue. Opened via the "?" key
 * or the header button -- Radix's Dialog already closes on Esc, so no extra
 * key handling is needed here.
 */
export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Work through the queue without touching the mouse. Shortcuts are disabled while
            typing in Notes or any other text field, except Cmd+Enter/Ctrl+Enter.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2.5">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-start justify-between gap-4">
              <dt>
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-700">
                  {shortcut.keys}
                </kbd>
              </dt>
              <dd className="flex-1 text-right text-sm text-zinc-600">{shortcut.description}</dd>
            </div>
          ))}
        </dl>

        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Tip: filter Score Status to &quot;Not Scored&quot; before opening the queue -- position
          in the queue then equals the applicants you still have left to score.
        </p>
      </DialogContent>
    </Dialog>
  );
}
