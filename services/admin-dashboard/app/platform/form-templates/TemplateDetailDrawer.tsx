"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { fetchFormTemplateDetail, type FormTemplateDetail } from "@/app/components/submissionsMasterData/form-fields/catalog-api";

interface Props {
  open: boolean;
  templateId: string | null;
  onClose: () => void;
}

export function TemplateDetailDrawer({ open, templateId, onClose }: Props) {
  const [detail, setDetail] = useState<FormTemplateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !templateId) {
      return;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing fetch lifecycle
    setLoading(true);
    setError(null);
    setDetail(null);
    fetchFormTemplateDetail(templateId)
      .then((d) => {
        if (!cancelled) setDetail(d);
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
          <SheetTitle>{detail?.name ?? "Template"}</SheetTitle>
          <SheetDescription>
            {detail?.description ?? "Template details"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-6 py-6">
          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          {loading && <p className="text-xs text-zinc-500">Loading…</p>}
          {detail && (
            <>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {detail.category && (
                  <span className="rounded bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">
                    {detail.category}
                  </span>
                )}
                {detail.isDefault && (
                  <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    Default
                  </span>
                )}
                <span className="rounded bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">
                  {detail.fields.length} fields
                </span>
              </div>

              <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/70 uppercase tracking-wider text-zinc-500">
                      <th className="px-3 py-2 font-semibold">Label / Key</th>
                      <th className="px-3 py-2 font-semibold">Section</th>
                      <th className="px-3 py-2 font-semibold">Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {detail.fields.map((f) => {
                      const key = f.source === "system" ? f.systemFieldKey : f.name;
                      return (
                        <tr key={f.id}>
                          <td className="px-3 py-2">
                            <div className="font-medium text-zinc-800">
                              {f.labelOverride ?? f.label ?? key}
                            </div>
                            <div className="font-mono text-[10px] text-zinc-500">
                              {f.source} · {key}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{f.section}</td>
                          <td className="px-3 py-2">
                            {f.isRequired ? (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Yes
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-400">No</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-zinc-500">
                Field editing for templates is managed via the seed script today. The metadata
                (name, description, category, default flag) can be edited via the &quot;Edit&quot; button.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
