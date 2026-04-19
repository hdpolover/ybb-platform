"use client";

import { useEffect, useState } from "react";
import { PhotoIcon } from "@heroicons/react/24/outline";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
} from "@/app/components/submissionsMasterData/api";
import type { MediaFile } from "@/src/shared/api-client";
import { OptionsRepeater, type OptionRow } from "./OptionsRepeater";
import { ValidationRulesEditor, type ValidationRules } from "./ValidationRulesEditor";
import { MediaLibraryPicker } from "./MediaLibraryPicker";
import type { ApplicationFormFieldRow } from "./FormFieldsTable";

export const SECTION_OPTIONS = [
  { value: "personal_details", label: "Personal Details" },
  { value: "contact_information", label: "Contact Information" },
  { value: "professional_profile", label: "Professional Profile" },
  { value: "entry_information", label: "Entry Information" },
  { value: "miscellaneous", label: "Miscellaneous" },
  { value: "documents", label: "Documents" },
  { value: "category", label: "Category" },
];

const FIELD_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "URL" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown (one choice)" },
  { value: "radio", label: "Radio buttons (one choice)" },
  { value: "checkbox", label: "Checkboxes (multiple choices)" },
  { value: "file", label: "File upload" },
];

const TYPES_WITH_OPTIONS = new Set(["select", "radio", "checkbox"]);

interface FormFieldEditorProps {
  open: boolean;
  initialField: ApplicationFormFieldRow | null;
  programId: string;
  onClose: () => void;
  onSaved: () => void;
}

type EditorState = {
  section: string;
  fieldName: string;
  label: string;
  placeholder: string;
  helpText: string;
  mediaUrl: string;
  mediaAlt: string;
  fieldType: string;
  isRequired: boolean;
  options: OptionRow[];
  validationRules: ValidationRules;
  defaultValue: string;
  order: number;
};

/** Coerces whatever shape the server stored in `options` into {label,value} rows. */
function optionsToRows(raw: unknown): OptionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { label: item, value: item };
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const label = typeof rec.label === "string" ? rec.label : String(rec.value ?? "");
        const value = typeof rec.value === "string" ? rec.value : label;
        return { label, value };
      }
      return { label: "", value: "" };
    })
    .filter((r) => r.label || r.value);
}

function validationRulesFromRaw(raw: unknown): ValidationRules {
  if (!raw || typeof raw !== "object") return {};
  const rec = raw as Record<string, unknown>;
  const pick = <K extends keyof ValidationRules>(key: K): ValidationRules[K] => {
    const v = rec[key as string];
    if (v == null) return undefined;
    if (key === "minLength" || key === "maxLength" || key === "min" || key === "max" || key === "maxSize") {
      const n = Number(v);
      return (Number.isFinite(n) ? n : undefined) as ValidationRules[K];
    }
    return (typeof v === "string" ? v : undefined) as ValidationRules[K];
  };
  return {
    minLength: pick("minLength"),
    maxLength: pick("maxLength"),
    min: pick("min"),
    max: pick("max"),
    maxSize: pick("maxSize"),
    accept: pick("accept"),
    minDate: pick("minDate"),
    maxDate: pick("maxDate"),
    pattern: pick("pattern"),
  };
}

function toEditorState(field: ApplicationFormFieldRow | null): EditorState {
  if (!field) {
    return {
      section: "personal_details",
      fieldName: "",
      label: "",
      placeholder: "",
      helpText: "",
      mediaUrl: "",
      mediaAlt: "",
      fieldType: "text",
      isRequired: false,
      options: [],
      validationRules: {},
      defaultValue: "",
      order: 0,
    };
  }
  return {
    section: field.section ?? "personal_details",
    fieldName: field.fieldName,
    label: field.label,
    placeholder: field.placeholder ?? "",
    helpText: field.helpText ?? "",
    mediaUrl: field.mediaUrl ?? "",
    mediaAlt: field.mediaAlt ?? "",
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    options: optionsToRows(field.options),
    validationRules: validationRulesFromRaw(field.validationRules),
    defaultValue: field.defaultValue ?? "",
    order: field.order ?? 0,
  };
}

/** Drop empty entries from validation rules so we don't send `{minLength: undefined}`. */
function pruneRules(rules: ValidationRules): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rules)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function FormFieldEditor({
  open,
  initialField,
  programId,
  onClose,
  onSaved,
}: FormFieldEditorProps) {
  const { accessiblePrograms } = useAuth();
  const brandId =
    accessiblePrograms.find((p) => p.programId === programId)?.brandId ?? "";

  const [state, setState] = useState<EditorState>(() => toEditorState(initialField));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reset state when the drawer opens against a different field
  useEffect(() => {
    if (open) {
      setState(toEditorState(initialField));
      setError(null);
    }
  }, [open, initialField]);

  const isEditing = !!initialField;
  const needsOptions = TYPES_WITH_OPTIONS.has(state.fieldType);

  function patch<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const fieldName = state.fieldName.trim();
    const label = state.label.trim();
    if (!fieldName || !label) {
      setError("Field Key and Label are required.");
      return;
    }
    if (needsOptions && state.options.filter((o) => o.label.trim()).length === 0) {
      setError("Add at least one option for this field type.");
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setError("You must be signed in to save form fields.");
      return;
    }

    const body: Record<string, unknown> = {
      section: state.section || undefined,
      fieldName,
      label,
      placeholder: state.placeholder.trim() || undefined,
      helpText: state.helpText.trim() || undefined,
      mediaUrl: state.mediaUrl.trim() || undefined,
      mediaAlt: state.mediaAlt.trim() || undefined,
      fieldType: state.fieldType,
      isRequired: state.isRequired,
      defaultValue: state.defaultValue.trim() || undefined,
      order: state.order,
      options: needsOptions
        ? state.options
            .filter((o) => o.label.trim())
            .map((o) => ({ label: o.label.trim(), value: (o.value || o.label).trim() }))
        : undefined,
      validationRules: needsOptions ? undefined : pruneRules(state.validationRules),
    };

    const path = isEditing
      ? `/programs/form-fields/${encodeURIComponent(initialField!.id)}`
      : `/programs/${encodeURIComponent(programId)}/form-fields`;
    const method = isEditing ? "PUT" : "POST";

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl(path), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save form field.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>{isEditing ? "Edit Form Field" : "Add Form Field"}</SheetTitle>
          <SheetDescription>
            Configure how applicants will see and fill out this input on the submission form.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-6 py-6">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Basic info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Section">
              <select
                value={state.section}
                onChange={(e) => patch("section", e.target.value)}
                className={INPUT_CLS}
              >
                {SECTION_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Field Type">
              <select
                value={state.fieldType}
                onChange={(e) => patch("fieldType", e.target.value)}
                className={INPUT_CLS}
              >
                {FIELD_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Field Key"
              hint="Internal identifier. Lowercase with underscores (e.g. tshirt_size)."
            >
              <input
                type="text"
                value={state.fieldName}
                onChange={(e) => patch("fieldName", e.target.value)}
                placeholder="tshirt_size"
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Label" hint="What applicants will see next to the input.">
              <input
                type="text"
                value={state.label}
                onChange={(e) => patch("label", e.target.value)}
                placeholder="T-Shirt Size"
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Placeholder" hint="Light-gray hint text inside an empty input.">
              <input
                type="text"
                value={state.placeholder}
                onChange={(e) => patch("placeholder", e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Default Value">
              <input
                type="text"
                value={state.defaultValue}
                onChange={(e) => patch("defaultValue", e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Display Order">
              <input
                type="number"
                value={state.order}
                onChange={(e) => patch("order", Number(e.target.value) || 0)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Required?">
              <select
                value={state.isRequired ? "true" : "false"}
                onChange={(e) => patch("isRequired", e.target.value === "true")}
                className={INPUT_CLS}
              >
                <option value="false">Optional</option>
                <option value="true">Required</option>
              </select>
            </Field>
          </div>

          <Field label="Help Text" hint="Shown below the input to guide applicants.">
            <textarea
              rows={3}
              value={state.helpText}
              onChange={(e) => patch("helpText", e.target.value)}
              className={INPUT_CLS}
            />
          </Field>

          {/* Options (only for select/radio/checkbox) */}
          {needsOptions && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-zinc-900">Choices</h4>
              <p className="text-xs text-zinc-500">
                List what the applicant can pick from. The label is what they see; the value
                is what we store (auto-filled based on the label).
              </p>
              <OptionsRepeater
                value={state.options}
                onChange={(next) => patch("options", next)}
              />
            </section>
          )}

          {/* Validation */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-zinc-900">Validation</h4>
            <ValidationRulesEditor
              fieldType={state.fieldType}
              value={state.validationRules}
              onChange={(next) => patch("validationRules", next)}
            />
          </section>

          {/* Supporting media */}
          <section className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900">
              <PhotoIcon className="h-4 w-4" />
              <span>Supporting Media</span>
            </div>
            <p className="mb-3 text-xs text-blue-700">
              Attach an image to show alongside the field (e.g. a T-shirt size guide).
            </p>

            {state.mediaUrl ? (
              <div className="mb-3 flex items-start gap-3 rounded-md border border-zinc-200 bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.mediaUrl}
                  alt={state.mediaAlt || "Selected media"}
                  className="h-16 w-16 rounded object-cover"
                />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-xs font-medium text-zinc-800">
                    {state.mediaUrl}
                  </p>
                  <button
                    type="button"
                    onClick={() => patch("mediaUrl", "")}
                    className="mt-1 text-[11px] font-medium text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
              >
                <PhotoIcon className="h-4 w-4" />
                {state.mediaUrl ? "Change from Library" : "Pick from Library"}
              </button>
              <span className="text-[11px] text-zinc-500">or</span>
              <input
                type="text"
                value={state.mediaUrl}
                onChange={(e) => patch("mediaUrl", e.target.value)}
                placeholder="Paste an image URL"
                className="flex-1 min-w-[200px] rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="mt-3">
              <Field label="Alt text" hint="Describes the image for screen readers.">
                <input
                  type="text"
                  value={state.mediaAlt}
                  onChange={(e) => patch("mediaAlt", e.target.value)}
                  placeholder="T-shirt size guide"
                  className={INPUT_CLS}
                />
              </Field>
            </div>
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
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Field"}
          </button>
        </div>

        <MediaLibraryPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          programId={programId}
          brandId={brandId}
          defaultAssetType="image"
          onPick={(file: MediaFile) => {
            patch("mediaUrl", file.url ?? "");
            if (!state.mediaAlt) {
              patch("mediaAlt", file.original_filename);
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
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
      <label className="mb-1.5 block text-xs font-medium text-zinc-600">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}
