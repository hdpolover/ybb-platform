"use client";

import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  createSystemFormField,
  updateSystemFormField,
  type SystemFormField,
  type CreateSystemFormFieldInput,
  type UpdateSystemFormFieldInput,
} from "@/app/components/submissionsMasterData/form-fields/catalog-api";

const CATEGORY_OPTIONS = [
  { value: "identity", label: "Identity" },
  { value: "program_structure", label: "Program Structure" },
  { value: "professional", label: "Professional" },
  { value: "logistics", label: "Logistics" },
  { value: "misc", label: "Misc" },
];

const TYPE_OPTIONS = [
  "text", "textarea", "email", "phone", "url", "number", "date",
  "select", "radio", "checkbox", "file",
];

type Option = { label: string; value: string };

interface Props {
  open: boolean;
  initialField: SystemFormField | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SystemFieldFormModal({ open, initialField, onClose, onSaved }: Props) {
  const isEdit = initialField !== null;
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("identity");
  const [type, setType] = useState("text");
  const [helpText, setHelpText] = useState("");
  const [order, setOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [options, setOptions] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialField) {
      setKey(initialField.key);
      setLabel(initialField.label);
      setCategory(initialField.category);
      setType(initialField.type);
      setHelpText(initialField.helpText ?? "");
      setOrder(initialField.order);
      setIsActive(initialField.isActive);
      setOptions(initialField.defaultOptions ?? []);
    } else {
      setKey("");
      setLabel("");
      setCategory("identity");
      setType("text");
      setHelpText("");
      setOrder(0);
      setIsActive(true);
      setOptions([]);
    }
    setError(null);
  }, [open, initialField]);

  if (!open) return null;

  const needsOptions = ["select", "radio", "checkbox"].includes(type);

  async function handleSave() {
    const trimmedKey = key.trim();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError("Label is required.");
      return;
    }
    if (!isEdit && !/^[a-z][a-z0-9_]{0,63}$/.test(trimmedKey)) {
      setError("Key must be lowercase letters/digits/underscores, start with a letter, max 64 chars.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const cleanedOptions = options
        .map((o) => ({ label: o.label.trim(), value: (o.value || o.label).trim() }))
        .filter((o) => o.label);
      if (isEdit && initialField) {
        const body: UpdateSystemFormFieldInput = {
          label: trimmedLabel,
          category,
          type,
          helpText: helpText.trim() || undefined,
          order,
          isActive,
          ...(needsOptions ? { defaultOptions: cleanedOptions } : { defaultOptions: [] }),
        };
        await updateSystemFormField(initialField.id, body);
        toast.success(`Updated "${trimmedLabel}"`);
      } else {
        const body: CreateSystemFormFieldInput = {
          key: trimmedKey,
          label: trimmedLabel,
          category,
          type,
          helpText: helpText.trim() || undefined,
          order,
          ...(needsOptions ? { defaultOptions: cleanedOptions } : {}),
        };
        await createSystemFormField(body);
        toast.success(`Created "${trimmedLabel}"`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            {isEdit ? `Edit "${initialField?.label}"` : "New System Field"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Key</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={isEdit}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500"
                placeholder="tshirt_size"
              />
              {!isEdit && (
                <p className="mt-1 text-[10px] text-zinc-500">Cannot be changed after creation.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="T-Shirt Size"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Order</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value) || 0)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            {isEdit && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Active?</label>
                <select
                  value={isActive ? "true" : "false"}
                  onChange={(e) => setIsActive(e.target.value === "true")}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Help text</label>
            <textarea
              rows={2}
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          {needsOptions && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Choices (label/value)
              </label>
              <div className="space-y-1.5">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={o.label}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = { ...next[i], label: e.target.value };
                        setOptions(next);
                      }}
                      placeholder="Label"
                      className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={o.value}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = { ...next[i], value: e.target.value };
                        setOptions(next);
                      }}
                      placeholder="Value"
                      className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setOptions([...options, { label: "", value: "" }])}
                  className="rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  ＋ Add choice
                </button>
              </div>
            </div>
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
