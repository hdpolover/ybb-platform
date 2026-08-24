// services/admin-dashboard/app/components/shared/content-templates/EditContentTemplateDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import { updateContentTemplate, type ContentTemplateSummary } from "./content-templates-api";

interface EditContentTemplateDialogProps {
  open: boolean;
  template: ContentTemplateSummary | null;
  entityLabel: string;
  onClose: () => void;
  onSaved: () => void;
}

// Payload is immutable after creation (no API to change it), so this form
// intentionally only ever touches name/description/isDefault — see
// content-templates-api.ts's updateContentTemplate. Adding a payload field
// here would silently no-op, which is worse than not offering it at all.
export function EditContentTemplateDialog({
  open,
  template,
  entityLabel,
  onClose,
  onSaved,
}: EditContentTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !template) return;
    setName(template.name);
    setDescription(template.description ?? "");
    setIsDefault(template.isDefault);
    setError(null);
  }, [open, template]);

  const willReplaceDefault = isDefault && !template?.isDefault;
  const canSave = !!template && name.trim().length > 0 && !saving;

  async function handleSave() {
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      await updateContentTemplate(template.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        isDefault,
      });
      toast.success(`Saved "${name.trim()}"`);
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save template";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit template</SheetTitle>
          <SheetDescription>
            Update this {entityLabel.toLowerCase()} template&apos;s name, description, or default status. Its content
            is fixed at creation and can&apos;t be changed here.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-1 flex-col gap-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-1">
            <Label htmlFor="template-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="template-description">Description</Label>
            <textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              placeholder="Optional"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Default {entityLabel.toLowerCase()} template
          </label>
          {willReplaceDefault && (
            <p className="text-xs text-amber-600">
              This will replace the current default {entityLabel.toLowerCase()} template, if any.
            </p>
          )}

          <div className="mt-auto flex justify-end gap-3 border-t border-zinc-200 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={!canSave} loading={saving}>
              Save changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
