"use client";

import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  createFormTemplate,
  updateFormTemplate,
  fetchSystemFormFields,
  fetchFormTemplateDetail,
  type CreateFormTemplateFieldInput,
  type FormTemplateSummary,
  type SystemFormField,
} from "@/app/components/submissionsMasterData/form-fields/catalog-api";

interface Props {
  open: boolean;
  template: FormTemplateSummary | null; // null = create mode
  onClose: () => void;
  onSaved: () => void;
}

const SECTIONS = [
  { value: "personal_details", label: "Personal Details" },
  { value: "contact_information", label: "Contact Information" },
  { value: "professional_profile", label: "Professional Profile" },
  { value: "entry_information", label: "Entry Information" },
  { value: "miscellaneous", label: "Miscellaneous" },
];

export function TemplateFormModal({ open, template, onClose, onSaved }: Props) {
  const isEdit = template !== null;

  // Metadata
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // Fields (create mode only)
  const [catalog, setCatalog] = useState<SystemFormField[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [defaultSection, setDefaultSection] = useState("personal_details");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (template) {
      setName(template.name);
      setDescription(template.description ?? "");
      setCategory(template.category ?? "");
      setIsDefault(template.isDefault);
      // Preload existing field keys for reference (not editable in this MVP)
      fetchFormTemplateDetail(template.id)
        .then((detail) => {
          const keys = new Set(
            detail.fields
              .map((f) => (f.source === "system" ? f.systemFieldKey : f.name))
              .filter((k): k is string => !!k),
          );
          setSelectedKeys(keys);
        })
        .catch(() => {
          /* non-fatal */
        });
    } else {
      setName("");
      setDescription("");
      setCategory("");
      setIsDefault(false);
      setSelectedKeys(new Set());
    }
    setDefaultSection("personal_details");
    fetchSystemFormFields()
      .then((rows) => setCatalog(rows.filter((r) => r.isActive)))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load catalog"),
      );
  }, [open, template]);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && template) {
        await updateFormTemplate(template.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          isDefault,
        });
        toast.success(`Updated "${name}"`);
      } else {
        if (selectedKeys.size === 0) {
          setError("Pick at least one field.");
          setSaving(false);
          return;
        }
        const fields: CreateFormTemplateFieldInput[] = [...selectedKeys].map((key, idx) => ({
          source: "system",
          systemFieldKey: key,
          section: defaultSection,
          isRequired: false,
          order: idx + 1,
        }));
        await createFormTemplate({
          name: name.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          isDefault,
          fields,
        });
        toast.success(`Created "${name}"`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const grouped = new Map<string, SystemFormField[]>();
  for (const f of catalog) {
    const arr = grouped.get(f.category) ?? [];
    arr.push(f);
    grouped.set(f.category, arr);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            {isEdit ? `Edit "${template?.name}"` : "New Template"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              placeholder="Standard Program Application"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="standard, leadership…"
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Default?</label>
              <select
                value={isDefault ? "true" : "false"}
                onChange={(e) => setIsDefault(e.target.value === "true")}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </div>

          {!isEdit && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Default section for new fields
                </label>
                <select
                  value={defaultSection}
                  onChange={(e) => setDefaultSection(e.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  {SECTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Pick catalog fields ({selectedKeys.size} selected)
                </label>
                <div className="max-h-80 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-2">
                  {[...grouped].map(([cat, fields]) => (
                    <div key={cat} className="mb-2">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {cat.replace(/_/g, " ")}
                      </div>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {fields.map((f) => {
                          const checked = selectedKeys.has(f.key);
                          return (
                            <label
                              key={f.id}
                              className={
                                checked
                                  ? "flex items-center gap-2 rounded-md border-2 border-blue-400 bg-blue-50 px-2 py-1.5 text-xs"
                                  : "flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs hover:border-zinc-300"
                              }
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = new Set(selectedKeys);
                                  if (next.has(f.key)) next.delete(f.key);
                                  else next.add(f.key);
                                  setSelectedKeys(next);
                                }}
                              />
                              <span className="truncate font-medium text-zinc-800">{f.label}</span>
                              {f.isMagic && <span className="text-[10px] text-blue-600">⚙️</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {isEdit && (
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
              Field list editing is managed via the seed script today. This form edits metadata only.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
