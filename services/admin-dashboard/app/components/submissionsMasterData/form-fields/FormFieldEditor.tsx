"use client";

import { useEffect, useRef, useState } from "react";
import { CloudArrowUpIcon, PhotoIcon } from "@heroicons/react/24/outline";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { useAuth } from "@/app/contexts/AuthContext";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";
import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
} from "@/app/components/submissionsMasterData/api";
import { uploadFileViaPresignedUrl, type MediaFile } from "@/src/shared/api-client";
import { OptionsRepeater, type OptionRow } from "./OptionsRepeater";
import { ValidationRulesEditor, type ValidationRules } from "./ValidationRulesEditor";
import { MediaLibraryPicker } from "./MediaLibraryPicker";
import { HelpAssetsRepeater, type HelpAssetRow, HELP_ASSETS_MAX } from "./HelpAssetsRepeater";
import type { ApplicationFormFieldRow } from "./FormFieldsTable";

const SLUG_MAX_LEN = 64;

function autoSlug(input: string): string {
  if (!input) return "";
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return "";
  const prefixed = /^[0-9]/.test(normalized) ? `f_${normalized}` : normalized;
  return prefixed.slice(0, SLUG_MAX_LEN);
}

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
  { value: "country", label: "Country (searchable)" },
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
  helpAssets: HelpAssetRow[];
  fieldType: string;
  isRequired: boolean;
  options: OptionRow[];
  validationRules: ValidationRules;
  defaultValue: string;
  order: number;
  fieldNameTouched: boolean;
  advancedOpen: boolean;
};

function helpAssetsFromRaw(raw: unknown): HelpAssetRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const label = typeof rec.label === "string" ? rec.label : "";
      const url = typeof rec.url === "string" ? rec.url : "";
      if (kind !== "link" && kind !== "video" && kind !== "file") return null;
      return { kind, label, url } as HelpAssetRow;
    })
    .filter((r): r is HelpAssetRow => r !== null)
    .slice(0, HELP_ASSETS_MAX);
}

/**
 * Coerces whatever shape the server stored in `options` into {label,value}
 * rows. Handles string arrays (`["S","M"]`), canonical object arrays
 * (`[{label, value}]`), legacy keys (`text`/`name`/`id`), and — defensively —
 * a JSON-encoded string of any of the above, in case the column was written
 * by an older code path that stringified before saving.
 */
function optionsToRows(raw: unknown): OptionRow[] {
  // Defensive: unwrap a JSON string if someone stored options stringified.
  let source: unknown = raw;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try { source = JSON.parse(trimmed); } catch { /* fall through; yields [] */ }
    }
  }
  // Legacy wrapping shape some seeds used: { options: [...] }
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const record = source as Record<string, unknown>;
    const wrapped = record.options;
    if (Array.isArray(wrapped)) {
      source = wrapped;
    } else {
      // Legacy key-value map shape: { male: "Male", female: "Female" }
      return Object.entries(record)
        .map(([value, rawLabel]) => {
          if (typeof rawLabel === "string") {
            return { label: rawLabel || value, value };
          }
          if (Array.isArray(rawLabel)) {
            const first = typeof rawLabel[0] === "string" ? rawLabel[0].trim() : "";
            const second = typeof rawLabel[1] === "string" ? rawLabel[1].trim() : "";
            const label = second || first || value;
            const normalizedValue = first || second || value;
            return { label, value: normalizedValue };
          }
          if (rawLabel && typeof rawLabel === "object") {
            const rec = rawLabel as Record<string, unknown>;
            const label =
              (typeof rec.label === "string" && rec.label)
              || (typeof rec.text === "string" && rec.text)
              || (typeof rec.name === "string" && rec.name)
              || value;
            const normalizedValue =
              (typeof rec.value === "string" && rec.value)
              || (typeof rec.id === "string" && rec.id)
              || value;
            return { label, value: normalizedValue };
          }
          return { label: value, value };
        })
        .filter((r) => r.label || r.value);
    }
  }
  if (!Array.isArray(source)) return [];

  return source
    .map((item) => {
      if (typeof item === "string") return { label: item, value: item };
      if (Array.isArray(item)) {
        const first = typeof item[0] === "string" ? item[0].trim() : "";
        const second = typeof item[1] === "string" ? item[1].trim() : "";
        const label = second || first;
        const value = first || second;
        return { label, value };
      }
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const rawLabel =
          (typeof rec.label === "string" && rec.label) ||
          (typeof rec.text === "string" && rec.text) ||
          (typeof rec.name === "string" && rec.name) ||
          "";
        const rawValue =
          (typeof rec.value === "string" && rec.value) ||
          (typeof rec.id === "string" && rec.id) ||
          "";
        const label = rawLabel || rawValue;
        const value = rawValue || label;
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
      helpAssets: [],
      fieldType: "text",
      isRequired: false,
      options: [],
      validationRules: {},
      defaultValue: "",
      order: 0,
      fieldNameTouched: false,
      advancedOpen: false,
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
    helpAssets: helpAssetsFromRaw(field.helpAssets),
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    options: optionsToRows(field.options),
    validationRules: validationRulesFromRaw(field.validationRules),
    defaultValue: field.defaultValue ?? "",
    order: field.order ?? 0,
    fieldNameTouched: true,
    advancedOpen: false,
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

function normalizeRichText(value: string): string | undefined {
  const html = value.trim();
  if (!html) return undefined;

  const plain = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, "")
    .trim();

  return plain ? html : undefined;
}

export function FormFieldEditor({
  open,
  initialField,
  programId,
  onClose,
  onSaved,
}: FormFieldEditorProps) {
  const { accessiblePrograms, adminProfile } = useAuth();
  const brandId =
    accessiblePrograms.find((p) => p.programId === programId)?.brandId ?? "";
  const mediaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<EditorState>(() => toEditorState(initialField));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Reset state when the drawer opens against a different field. Also clear
  // `saving` defensively — if a prior save was interrupted (navigation, error
  // in finally) the button would otherwise stay disabled on reopen.
  useEffect(() => {
    if (open) {
      setState(toEditorState(initialField));
      setError(null);
      setSaving(false);
      setIsUploadingMedia(false);
    }
  }, [open, initialField]);

  function reportError(msg: string) {
    setError(msg);
    // The error banner is at the top of a scrolling drawer; the user is
    // usually at the bottom when they click Save, so scroll it into view.
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  const isEditing = !!initialField;
  const needsOptions = TYPES_WITH_OPTIONS.has(state.fieldType);

  function patch<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleUploadMediaFromComputer(file: File | null) {
    if (!file) {
      return;
    }

    if (!adminProfile?.userId) {
      reportError("You must be signed in to upload media files.");
      return;
    }

    if (!brandId) {
      reportError("Unable to resolve brand context for upload.");
      return;
    }

    setIsUploadingMedia(true);
    setError(null);

    try {
      const upload = await uploadFileViaPresignedUrl(file, {
        userId: adminProfile.userId,
        brandId,
        programId,
        bucket: "gallery",
        assetType: "image",
        title: file.name,
        altText: state.mediaAlt.trim() || state.label.trim() || file.name,
      });

      if (!upload.publicUrl) {
        throw new Error("Upload succeeded but no public URL was returned.");
      }

      patch("mediaUrl", upload.publicUrl);
      if (!state.mediaAlt.trim()) {
        patch("mediaAlt", file.name);
      }
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Failed to upload media file.");
    } finally {
      setIsUploadingMedia(false);
    }
  }

  async function handleSave() {
    if (isUploadingMedia) {
      reportError("Please wait for the media upload to finish before saving.");
      return;
    }
    const fieldName = state.fieldName.trim();
    const label = state.label.trim();
    const initialFieldName = initialField?.fieldName?.trim() ?? "";
    const fieldNameChanged = !isEditing || fieldName !== initialFieldName;
    if (!fieldName || !label) {
      reportError("Field Key and Label are required.");
      return;
    }
    if (needsOptions && state.options.filter((o) => o.label.trim() || o.value.trim()).length === 0) {
      reportError("Add at least one option for this field type.");
      return;
    }

    const token = getAccessToken();
    if (!token) {
      reportError("You must be signed in to save form fields.");
      return;
    }

    const normalizedHelpAssets = state.helpAssets
      .map((a) => ({ kind: a.kind, label: a.label.trim(), url: a.url.trim() }))
      .filter((a) => a.label && a.url);
    const hadExistingHelpAssets = (initialField?.helpAssets?.length ?? 0) > 0;
    const shouldSendHelpAssets = normalizedHelpAssets.length > 0 || hadExistingHelpAssets;

      const body: Record<string, unknown> = {
        section: state.section || undefined,
        label,
        placeholder: state.placeholder.trim() || undefined,
        helpText: normalizeRichText(state.helpText),
        mediaUrl: state.mediaUrl.trim() || undefined,
        mediaAlt: state.mediaAlt.trim() || undefined,
        fieldType: state.fieldType,
      isRequired: state.isRequired,
      defaultValue: state.defaultValue.trim() || undefined,
      order: state.order,
      options: needsOptions
        ? state.options
            .filter((o) => o.label.trim() || o.value.trim())
            .map((o) => {
              const label = (o.label || o.value).trim();
              const value = (o.value || o.label).trim();
              return { label, value };
            })
        : undefined,
      validationRules: needsOptions ? undefined : pruneRules(state.validationRules),
    };

    if (!isEditing) {
      body.source = "custom";
    }

    if (fieldNameChanged) {
      body.fieldName = fieldName;
    }

    if (shouldSendHelpAssets) {
      body.helpAssets = normalizedHelpAssets;
    }

    const path = isEditing
      ? `/programs/form-fields/${encodeURIComponent(initialField!.id)}`
      : `/programs/${encodeURIComponent(programId)}/form-fields`;
    const method = isEditing ? "PUT" : "POST";

    setSaving(true);
    setError(null);
    try {
      const sendRequest = (requestBody: Record<string, unknown>) =>
        fetch(buildApiUrl(path), {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

      let response = await sendRequest(body);
      if (!response.ok) {
        const message = await readErrorMessage(response);
        const canRetryWithoutHelpAssets =
          shouldSendHelpAssets && /helpassets\s+should\s+not\s+exist/i.test(message);

        if (canRetryWithoutHelpAssets) {
          const fallbackBody = { ...body };
          delete fallbackBody.helpAssets;
          response = await sendRequest(fallbackBody);
        }

        if (!response.ok) throw new Error(await readErrorMessage(response));
      }

      onSaved();
      onClose();
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Failed to save form field.");
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
            <div
              ref={errorBannerRef}
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
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
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                Label <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={state.label}
                onChange={(e) => {
                  const newLabel = e.target.value;
                  setState((prev) => ({
                    ...prev,
                    label: newLabel,
                    ...(prev.fieldNameTouched
                      ? {}
                      : { fieldName: autoSlug(newLabel) }),
                  }));
                }}
                placeholder="T-Shirt Size"
                className={INPUT_CLS}
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                {state.fieldName ? (
                  <>
                    Will be stored as{" "}
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700">
                      {state.fieldName}
                    </code>
                  </>
                ) : (
                  "Will be stored as an auto-generated key from the label."
                )}{" "}
                <button
                  type="button"
                  onClick={() => patch("advancedOpen", !state.advancedOpen)}
                  className="text-blue-600 hover:underline"
                >
                  {state.advancedOpen ? "hide advanced" : "advanced"}
                </button>
              </p>
            </div>

            {state.advancedOpen && (
              <div className="sm:col-span-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
                <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                  Storage key (advanced)
                </label>
                <input
                  type="text"
                  value={state.fieldName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setState((prev) => ({
                      ...prev,
                      fieldName: value,
                      fieldNameTouched: true,
                    }));
                  }}
                  placeholder="tshirt_size"
                  className={INPUT_CLS}
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Auto-generated from the label. Only change this if you need to align
                  with an existing integration. Must start with a letter and use only
                  lowercase letters, digits, and underscores.
                </p>
              </div>
            )}
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
            <RichTextEditor
              content={state.helpText}
              onChange={(html) => patch("helpText", html)}
              placeholder="Write formatted guidance shown below the input..."
              className="[&_.ProseMirror]:min-h-[160px]"
            />
          </Field>

          {/* Options (only for select/radio/checkbox) */}
          {needsOptions && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-zinc-900">
                Choices <span className="text-rose-500">*</span>
              </h4>
              <p className="text-xs text-zinc-500">
                List what the applicant can pick from. The label is what they see; the value
                is what we store (auto-filled based on the label).
              </p>
              {state.options.filter((o) => o.label.trim() || o.value.trim()).length === 0 && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  At least one choice is required for a {state.fieldType} field. Add choices below before saving.
                </p>
              )}
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
                onClick={() => mediaUploadInputRef.current?.click()}
                disabled={saving || isUploadingMedia}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CloudArrowUpIcon className="h-4 w-4" />
                {isUploadingMedia ? "Uploading..." : "Upload from Computer"}
              </button>
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
              <input
                ref={mediaUploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleUploadMediaFromComputer(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
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

          {/* Guidance items: links, videos, templates */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-zinc-900">Guidance Items</h4>
            <p className="text-xs text-zinc-500">
              Attach example links, tutorial videos, or downloadable templates. Each item appears as a
              pill beneath the field on the applicant form and opens in a new tab.
            </p>
            <HelpAssetsRepeater
              value={state.helpAssets}
              onChange={(next) => patch("helpAssets", next)}
            />
          </section>
        </div>

        <div className="sticky bottom-0 z-10 border-t border-zinc-200 bg-white px-6 py-4">
          {error && (
            <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
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
              disabled={saving || isUploadingMedia}
              title={isUploadingMedia ? "Waiting for media upload to finish…" : undefined}
              className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : isUploadingMedia ? "Uploading…" : isEditing ? "Save Changes" : "Add Field"}
            </button>
          </div>
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
