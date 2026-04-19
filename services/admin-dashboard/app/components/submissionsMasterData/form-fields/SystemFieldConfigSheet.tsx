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
import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
} from "@/app/components/submissionsMasterData/api";
import type { SystemFormField } from "./catalog-api";
import { SECTION_OPTIONS } from "./FormFieldEditor";

interface SystemFieldConfigSheetProps {
  open: boolean;
  programId: string;
  systemField: SystemFormField;
  onClose: () => void;
  onSaved: () => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-600">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

export function SystemFieldConfigSheet({
  open,
  programId,
  systemField,
  onClose,
  onSaved,
}: SystemFieldConfigSheetProps) {
  const [section, setSection] = useState<string>("personal_details");
  const [isRequired, setIsRequired] = useState<boolean>(false);
  const [label, setLabel] = useState<string>(systemField.label);
  const [helpText, setHelpText] = useState<string>(
    systemField.helpText ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when a different systemField is passed in
  useEffect(() => {
    if (open) {
      setSection("personal_details");
      setIsRequired(false);
      setLabel(systemField.label);
      setHelpText(systemField.helpText ?? "");
      setError(null);
    }
  }, [open, systemField]);

  async function handleSave() {
    const token = getAccessToken();
    if (!token) {
      setError("You must be signed in to save form fields.");
      return;
    }

    const trimmedLabel = label.trim();
    const trimmedHelp = helpText.trim();
    const systemHelp = systemField.helpText ?? "";

    const body: Record<string, unknown> = {
      source: "system",
      systemFieldKey: systemField.key,
      fieldType: systemField.type,
      section,
      isRequired,
      // Send the label either way so the server has something to display
      label:
        trimmedLabel && trimmedLabel !== systemField.label
          ? trimmedLabel
          : systemField.label,
      order: 0,
    };

    // Only send helpText if it differs from the system default
    if (trimmedHelp !== systemHelp) {
      if (trimmedHelp) body.helpText = trimmedHelp;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        buildApiUrl(
          `/programs/${encodeURIComponent(programId)}/form-fields`,
        ),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error(await readErrorMessage(response));
      toast.success(`Added "${systemField.label}" to the form.`);
      onSaved();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save field.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-0"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>Configure &quot;{systemField.label}&quot;</SheetTitle>
          <SheetDescription>
            A built-in system field. The key and type are locked so reporting
            stays consistent across programs.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-6 py-6">
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            Stored as{" "}
            <code className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px]">
              {systemField.key}
            </code>{" "}
            — consistent across all programs.
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Section">
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className={INPUT_CLS}
              >
                {SECTION_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Required?">
              <select
                value={isRequired ? "true" : "false"}
                onChange={(e) => setIsRequired(e.target.value === "true")}
                className={INPUT_CLS}
              >
                <option value="false">Optional</option>
                <option value="true">Required</option>
              </select>
            </Field>
          </div>

          <Field
            label="Label"
            hint="Override the default label shown to applicants (optional)."
          >
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={INPUT_CLS}
            />
          </Field>

          <Field
            label="Help text"
            hint="Shown below the input to guide applicants (optional)."
          >
            <textarea
              rows={3}
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              className={INPUT_CLS}
            />
          </Field>

          <section className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Preview (read-only)
            </h4>
            <dl className="grid grid-cols-1 gap-1 text-xs text-zinc-700 sm:grid-cols-2">
              <dt className="font-semibold">Type</dt>
              <dd>{systemField.type}</dd>
              <dt className="font-semibold">Category</dt>
              <dd>{systemField.category}</dd>
              {systemField.defaultOptions.length > 0 && (
                <>
                  <dt className="font-semibold">Choices</dt>
                  <dd>
                    {systemField.defaultOptions
                      .map((o) => o.label)
                      .join(", ")}
                  </dd>
                </>
              )}
            </dl>
            <p className="mt-3 text-[11px] text-zinc-500">
              The type and choices are managed in the System Fields catalog
              (super-admin). Open that page to edit them.
            </p>
          </section>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add Field"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
