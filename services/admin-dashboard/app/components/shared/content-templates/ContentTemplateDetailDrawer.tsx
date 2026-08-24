// services/admin-dashboard/app/components/shared/content-templates/ContentTemplateDetailDrawer.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { Badge } from "@/src/ui/badge";
import { fetchContentTemplateDetail, type ContentTemplateDetail } from "./content-templates-api";

interface ContentTemplateDetailDrawerProps {
  open: boolean;
  templateId: string | null;
  onClose: () => void;
}

// Item shape differs per entityType (form-fields items look nothing like
// payments items), so a single drawer that works for all seven types renders
// the raw payload rather than a bespoke per-field layout. That's a real scope
// tradeoff (per-entityType rendering is real work, not asked for here), but
// this stays honest and always correct instead of guessing at a shape.
export function ContentTemplateDetailDrawer({ open, templateId, onClose }: ContentTemplateDetailDrawerProps) {
  const [detail, setDetail] = useState<ContentTemplateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset synchronously during render rather than in the effect below — the
  // effect's job is the actual fetch (a real external side effect); calling
  // setState directly in the effect body is exactly the pattern
  // react-hooks/set-state-in-effect flags — see the same fix already applied
  // in app/programs/[programId]/scoring/fully-funded/[participantId]/page.tsx.
  const activeKey = open ? templateId : null;
  const [prevActiveKey, setPrevActiveKey] = useState(activeKey);
  if (activeKey !== prevActiveKey) {
    setPrevActiveKey(activeKey);
    setDetail(null);
    setError(null);
    setLoading(!!activeKey);
  }

  useEffect(() => {
    if (!open || !templateId) return;
    let cancelled = false;
    fetchContentTemplateDetail(templateId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load template");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, templateId]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            {detail?.name ?? "Template"}
            {detail?.isDefault && <Badge variant="success">Default</Badge>}
          </SheetTitle>
          <SheetDescription>
            {detail
              ? `${detail.entityType} · ${detail.itemCount} item(s) · payload v${detail.payload.payloadVersion}`
              : "Loading…"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-6">
          {loading && <p className="text-xs text-zinc-500">Loading…</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {detail?.description && <p className="text-sm text-zinc-600">{detail.description}</p>}
          {detail && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Raw payload</h3>
              <pre className="max-h-[60vh] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                {JSON.stringify(detail.payload.items, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
