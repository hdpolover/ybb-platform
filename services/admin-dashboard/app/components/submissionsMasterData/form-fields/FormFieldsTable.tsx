"use client";

import { useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  QueueListIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
  readJsonData,
} from "@/app/components/submissionsMasterData/api";
import { fetchSystemFormFields, type SystemFormField } from "./catalog-api";
import { FormFieldEditor } from "./FormFieldEditor";
import { AddFieldDialog } from "./AddFieldDialog";
import { CopyFromTemplateDialog } from "./CopyFromTemplateDialog";
import { CopyFromProgramDialog } from "./CopyFromProgramDialog";
import type { HelpAssetRow } from "./HelpAssetsRepeater";

export interface ApplicationFormFieldRow {
  id: string;
  section?: string;
  fieldName: string;
  source?: "system" | "custom";
  systemFieldKey?: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  mediaUrl?: string;
  mediaAlt?: string;
  helpAssets?: HelpAssetRow[];
  fieldType: string;
  isRequired: boolean;
  options?: unknown;
  validationRules?: unknown;
  defaultValue?: string;
  order: number;
}

const OPTION_FIELD_TYPES = new Set(["select", "radio", "checkbox"]);

type NormalizedOption = { label: string; value: string };

function normalizeOptionEntry(
  item: unknown,
  fallbackValue?: string,
): NormalizedOption | undefined {
  if (typeof item === "string") {
    const value = item.trim();
    if (!value) return undefined;
    return { label: value, value };
  }

  // Legacy tuple-like shape: ["male", "Male"]
  if (Array.isArray(item)) {
    const first = typeof item[0] === "string" ? item[0].trim() : "";
    const second = typeof item[1] === "string" ? item[1].trim() : "";
    const label = second || first;
    const value = first || second || (fallbackValue ?? "").trim();
    if (!label && !value) return undefined;
    return { label: label || value, value: value || label };
  }

  if (!item || typeof item !== "object") {
    return undefined;
  }

  const rec = item as Record<string, unknown>;
  const rawLabel =
    (typeof rec.label === "string" && rec.label.trim()) ||
    (typeof rec.text === "string" && rec.text.trim()) ||
    (typeof rec.name === "string" && rec.name.trim()) ||
    (typeof rec.value === "string" && rec.value.trim()) ||
    (typeof rec.id === "string" && rec.id.trim()) ||
    "";

  const rawValue =
    (typeof rec.value === "string" && rec.value.trim()) ||
    (typeof rec.id === "string" && rec.id.trim()) ||
    (typeof rec.label === "string" && rec.label.trim()) ||
    (typeof rec.text === "string" && rec.text.trim()) ||
    (typeof rec.name === "string" && rec.name.trim()) ||
    (fallbackValue ?? "").trim() ||
    "";

  if (!rawLabel && !rawValue) {
    return undefined;
  }

  return {
    label: rawLabel || rawValue,
    value: rawValue || rawLabel,
  };
}

function normalizeOptions(raw: unknown): NormalizedOption[] | undefined {
  let source: unknown = raw;

  if (typeof source === "string") {
    const trimmed = source.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        return undefined;
      }
    }
  }

  if (Array.isArray(source)) {
    const normalized = source
      .map((item) => normalizeOptionEntry(item))
      .filter((item): item is NormalizedOption => item !== undefined);
    return normalized.length > 0 ? normalized : undefined;
  }

  if (!source || typeof source !== "object") {
    return undefined;
  }

  const rec = source as Record<string, unknown>;
  if (Array.isArray(rec.options)) {
    return normalizeOptions(rec.options);
  }

  const normalized = Object.entries(rec)
    .map(([value, item]) => normalizeOptionEntry(item, value))
    .filter((item): item is NormalizedOption => item !== undefined);

  return normalized.length > 0 ? normalized : undefined;
}

function hasOptions(raw: unknown): boolean {
  return (normalizeOptions(raw)?.length ?? 0) > 0;
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
  const normalized = normalizeOptions(options);
  if (!normalized) return "-";

  return normalized.map((option) => option.label || option.value).join(", ");
}

export function FormFieldsTable({ programId }: { programId: string }) {
  const [fields, setFields] = useState<ApplicationFormFieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [copyTemplateOpen, setCopyTemplateOpen] = useState(false);
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
  const [editingField, setEditingField] = useState<ApplicationFormFieldRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadFields = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        buildApiUrl(`/programs/${encodeURIComponent(programId)}/form-fields`),
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const payload = await readJsonData<ApplicationFormFieldRow[]>(response);

      let catalogByKey = new Map<string, SystemFormField>();
      try {
        const catalog = await fetchSystemFormFields();
        catalogByKey = new Map(catalog.map((row) => [row.key, row]));
      } catch {
        // Non-blocking: admin can still work without catalog fallback.
      }

      const hydratedPayload = payload.map((row) => {
        const fieldType = row.fieldType.toLowerCase();
        const normalizedOptions = normalizeOptions(row.options);

        if (!OPTION_FIELD_TYPES.has(fieldType)) {
          return { ...row, options: normalizedOptions };
        }

        if (hasOptions(normalizedOptions)) {
          return { ...row, options: normalizedOptions };
        }

        const lookupKey = row.systemFieldKey || row.fieldName;
        const fallbackOptions = normalizeOptions(catalogByKey.get(lookupKey)?.defaultOptions);

        return {
          ...row,
          options: fallbackOptions,
        };
      });

      const sortedPayload = [...hydratedPayload].sort((left, right) => left.order - right.order);
      setFields(sortedPayload);
    } catch (error) {
      setFields([]);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load form fields.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  const openCreate = () => {
    setAddDialogOpen(true);
  };

  const openEdit = (field: ApplicationFormFieldRow) => {
    setEditingField(field);
  };

  const handleDelete = async (field: ApplicationFormFieldRow) => {
    const token = getAccessToken();
    if (!token) {
      setErrorMessage("An admin access token is required to delete form fields.");
      return;
    }
    if (!window.confirm(`Delete the form field "${field.label}"?`)) return;

    setDeletingId(field.id);
    setErrorMessage(null);
    try {
      const response = await fetch(
        buildApiUrl(`/programs/form-fields/${encodeURIComponent(field.id)}`),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error(await readErrorMessage(response));
      await loadFields();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete form field.");
    } finally {
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCopyFromProgramOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <span>Copy from program</span>
          </button>
          <button
            type="button"
            onClick={() => setCopyTemplateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <span>Copy from template</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add Field</span>
          </button>
        </div>
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
              {loading ? (
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
                          onClick={() => openEdit(row)}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
                          title="Edit field"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          disabled={deletingId === row.id}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Delete field"
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

      <AddFieldDialog
        open={addDialogOpen}
        programId={programId}
        onClose={() => setAddDialogOpen(false)}
        onSaved={() => {
          setAddDialogOpen(false);
          void loadFields();
        }}
      />
      <CopyFromTemplateDialog
        open={copyTemplateOpen}
        programId={programId}
        onClose={() => setCopyTemplateOpen(false)}
        onApplied={() => {
          setCopyTemplateOpen(false);
          void loadFields();
        }}
      />
      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        programId={programId}
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
          void loadFields();
        }}
      />

      <FormFieldEditor
        open={editingField !== null}
        programId={programId}
        initialField={editingField}
        onClose={() => setEditingField(null)}
        onSaved={() => {
          setEditingField(null);
          void loadFields();
        }}
      />
    </section>
  );
}
