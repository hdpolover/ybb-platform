"use client";

import { useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
  QueueListIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import { buildApiUrl, getAccessToken, readErrorMessage } from "@/app/components/submissionsMasterData/api";

type FormFieldStatus = "idle" | "loading" | "saving";

export interface ApplicationFormFieldRow {
  id: string;
  section?: string;
  fieldName: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  mediaUrl?: string;
  mediaAlt?: string;
  fieldType: string;
  isRequired: boolean;
  options?: unknown;
  validationRules?: unknown;
  defaultValue?: string;
  order: number;
}

interface FormFieldModalState {
  id?: string;
  section: string;
  fieldName: string;
  label: string;
  placeholder: string;
  helpText: string;
  mediaUrl: string;
  mediaAlt: string;
  fieldType: string;
  isRequired: boolean;
  optionsText: string;
  validationRulesText: string;
  defaultValue: string;
  order: string;
}

const SECTION_OPTIONS = [
  { value: "personal_details", label: "Personal Details" },
  { value: "contact_information", label: "Contact Information" },
  { value: "professional_profile", label: "Professional Profile" },
  { value: "entry_information", label: "Entry Information" },
  { value: "miscellaneous", label: "Miscellaneous" },
  { value: "documents", label: "Documents" },
  { value: "category", label: "Category" },
];

const FIELD_TYPE_OPTIONS = [
  "text",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "file",
  "date",
  "email",
  "phone",
  "url",
];

function createEmptyFormState(): FormFieldModalState {
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
    optionsText: "",
    validationRulesText: "",
    defaultValue: "",
    order: "0",
  };
}

function toFormState(field?: ApplicationFormFieldRow): FormFieldModalState {
  if (!field) {
    return createEmptyFormState();
  }

  return {
    id: field.id,
    section: field.section ?? "personal_details",
    fieldName: field.fieldName,
    label: field.label,
    placeholder: field.placeholder ?? "",
    helpText: field.helpText ?? "",
    mediaUrl: field.mediaUrl ?? "",
    mediaAlt: field.mediaAlt ?? "",
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    optionsText: field.options ? JSON.stringify(field.options, null, 2) : "",
    validationRulesText: field.validationRules ? JSON.stringify(field.validationRules, null, 2) : "",
    defaultValue: field.defaultValue ?? "",
    order: String(field.order ?? 0),
  };
}

function formatSection(section?: string): string {
  if (!section) return "-";
  return section
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatOptions(options?: unknown): string {
  if (!options) return "-";
  if (Array.isArray(options)) {
    return options
      .map((option) => {
        if (typeof option === "string") return option;
        if (typeof option === "object" && option !== null) {
          const record = option as Record<string, unknown>;
          return String(record.label ?? record.value ?? "Option");
        }
        return String(option);
      })
      .join(", ");
  }

  return JSON.stringify(options);
}

function parseOptionalJson(value: string, fieldName: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`${fieldName} must be valid JSON.`);
  }
}

function FormFieldModal({
  isOpen,
  formState,
  onChange,
  onClose,
  onSubmit,
  isSaving,
  errorMessage,
}: {
  isOpen: boolean;
  formState: FormFieldModalState;
  onChange: (patch: Partial<FormFieldModalState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  errorMessage: string | null;
}) {
  if (!isOpen) return null;

  const isEditing = Boolean(formState.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditing ? "Edit Form Field" : "Add Form Field"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Configure input metadata, options, and supporting media for the participant submission form.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="space-y-5 px-6 py-6 text-left">
          {errorMessage ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Section</label>
              <select
                value={formState.section}
                onChange={(event) => onChange({ section: event.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {SECTION_OPTIONS.map((section) => (
                  <option key={section.value} value={section.value}>
                    {section.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Field Type</label>
              <select
                value={formState.fieldType}
                onChange={(event) => onChange({ fieldType: event.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {FIELD_TYPE_OPTIONS.map((fieldType) => (
                  <option key={fieldType} value={fieldType}>
                    {fieldType}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Field Key</label>
              <input
                type="text"
                value={formState.fieldName}
                onChange={(event) => onChange({ fieldName: event.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g. tshirt_size"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Label</label>
              <input
                type="text"
                value={formState.label}
                onChange={(event) => onChange({ label: event.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="T-Shirt Size"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Placeholder</label>
              <input
                type="text"
                value={formState.placeholder}
                onChange={(event) => onChange({ placeholder: event.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Default Value</label>
              <input
                type="text"
                value={formState.defaultValue}
                onChange={(event) => onChange({ defaultValue: event.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Display Order</label>
              <input
                type="number"
                value={formState.order}
                onChange={(event) => onChange({ order: event.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Required</label>
              <select
                value={formState.isRequired ? "true" : "false"}
                onChange={(event) => onChange({ isRequired: event.target.value === "true" })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="false">Optional</option>
                <option value="true">Required</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Help Text</label>
            <textarea
              rows={3}
              value={formState.helpText}
              onChange={(event) => onChange({ helpText: event.target.value })}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-900">
              <PhotoIcon className="h-4 w-4" />
              <span>Supporting Media</span>
            </div>
            <p className="mb-4 text-xs text-blue-700">
              Use this for contextual assets such as the T-shirt size guide image.
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Media URL</label>
                <input
                  type="url"
                  value={formState.mediaUrl}
                  onChange={(event) => onChange({ mediaUrl: event.target.value })}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="/img/shirtSize.webp"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Media Alt Text</label>
                <input
                  type="text"
                  value={formState.mediaAlt}
                  onChange={(event) => onChange({ mediaAlt: event.target.value })}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="T-shirt size guide"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Options JSON</label>
              <textarea
                rows={7}
                value={formState.optionsText}
                onChange={(event) => onChange({ optionsText: event.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder={'[{"label":"Small","value":"S"}]'}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Validation Rules JSON</label>
              <textarea
                rows={7}
                value={formState.validationRulesText}
                onChange={(event) => onChange({ validationRulesText: event.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder='{"maxLength":255}'
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSaving}
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FormFieldsTable({ programId }: { programId: string }) {
  const [fields, setFields] = useState<ApplicationFormFieldRow[]>([]);
  const [status, setStatus] = useState<FormFieldStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<FormFieldModalState>(createEmptyFormState());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadFields = async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(buildApiUrl(`/programs/${encodeURIComponent(programId)}/form-fields`), {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as ApplicationFormFieldRow[];
      const sortedPayload = [...payload].sort((left, right) => left.order - right.order);
      setFields(sortedPayload);
      setStatus("idle");
    } catch (error) {
      setFields([]);
      setStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Failed to load form fields.");
    }
  };

  useEffect(() => {
    void loadFields();
  }, [programId]);

  const openCreateModal = () => {
    setFormState(createEmptyFormState());
    setModalErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (field: ApplicationFormFieldRow) => {
    setFormState(toFormState(field));
    setModalErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalErrorMessage(null);
  };

  const handleSave = async () => {
    const token = getAccessToken();
    if (!token) {
      setModalErrorMessage("An admin access token is required to create or update form fields.");
      return;
    }

    const trimmedFieldName = formState.fieldName.trim();
    const trimmedLabel = formState.label.trim();

    if (!trimmedFieldName || !trimmedLabel) {
      setModalErrorMessage("Field key and label are required.");
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = {
        section: formState.section.trim() || undefined,
        fieldName: trimmedFieldName,
        label: trimmedLabel,
        placeholder: formState.placeholder.trim() || undefined,
        helpText: formState.helpText.trim() || undefined,
        mediaUrl: formState.mediaUrl.trim() || undefined,
        mediaAlt: formState.mediaAlt.trim() || undefined,
        fieldType: formState.fieldType,
        isRequired: formState.isRequired,
        options: parseOptionalJson(formState.optionsText, "Options"),
        validationRules: parseOptionalJson(formState.validationRulesText, "Validation rules"),
        defaultValue: formState.defaultValue.trim() || undefined,
        order: Number(formState.order || 0),
      };
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : "Invalid form field payload.");
      return;
    }

    if (Number.isNaN(payload.order)) {
      setModalErrorMessage("Display order must be a valid number.");
      return;
    }

    setStatus("saving");
    setModalErrorMessage(null);

    const isEditing = Boolean(formState.id);
    const path = isEditing
      ? `/programs/form-fields/${encodeURIComponent(formState.id as string)}`
      : `/programs/${encodeURIComponent(programId)}/form-fields`;

    try {
      const response = await fetch(buildApiUrl(path), {
        method: isEditing ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await loadFields();
      closeModal();
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : "Failed to save form field.");
      setStatus("idle");
    }
  };

  const handleDelete = async (field: ApplicationFormFieldRow) => {
    const token = getAccessToken();
    if (!token) {
      setErrorMessage("An admin access token is required to delete form fields.");
      return;
    }

    const isConfirmed = window.confirm(`Delete the form field "${field.label}"?`);
    if (!isConfirmed) {
      return;
    }

    setDeletingId(field.id);
    setErrorMessage(null);

    try {
      const response = await fetch(buildApiUrl(`/programs/form-fields/${encodeURIComponent(field.id)}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await loadFields();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete form field.");
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <QueueListIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Application Form Fields</h2>
            <p className="text-sm text-zinc-500">
              Manage dynamic participant form fields, including supporting media such as the T-shirt size guide.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Field</span>
        </button>
      </div>

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
                <th className="w-12 px-6 py-4 font-semibold">No</th>
                <th className="px-6 py-4 font-semibold">Field</th>
                <th className="px-6 py-4 font-semibold">Section</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Options</th>
                <th className="px-6 py-4 font-semibold">Media</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {status === "loading" ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Loading form fields...
                  </td>
                </tr>
              ) : fields.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-zinc-500">
                    No form fields configured yet.
                  </td>
                </tr>
              ) : (
                fields.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                    <td className="px-6 py-4 align-top">
                      <div className="space-y-1">
                        <div className="font-semibold text-zinc-900">{row.label}</div>
                        <div className="text-xs text-zinc-500">{row.fieldName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-zinc-600">{formatSection(row.section)}</td>
                    <td className="px-6 py-4 align-top text-zinc-600">
                      <div className="space-y-1">
                        <div>{row.fieldType}</div>
                        <div className="text-xs text-zinc-500">Order: {row.order}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-zinc-600">{formatOptions(row.options)}</td>
                    <td className="px-6 py-4 align-top">
                      {row.mediaUrl ? (
                        <div className="space-y-1 text-xs">
                          <a
                            href={row.mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-700 underline-offset-2 hover:underline"
                          >
                            View media
                          </a>
                          <div className="text-zinc-500">{row.mediaAlt || "No alt text"}</div>
                        </div>
                      ) : (
                        <span className="text-zinc-400">No media</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <span
                        className={`inline-flex rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                          row.isRequired ? " bg-emerald-50 text-emerald-700" : " bg-zinc-50 text-zinc-600"
                        }`}
                      >
                        {row.isRequired ? "Required" : "Optional"}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          disabled={deletingId === row.id}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <FormFieldModal
        isOpen={isModalOpen}
        formState={formState}
        onChange={(patch) => setFormState((current) => ({ ...current, ...patch }))}
        onClose={closeModal}
        onSubmit={() => void handleSave()}
        isSaving={status === "saving"}
        errorMessage={modalErrorMessage}
      />
    </section>
  );
}