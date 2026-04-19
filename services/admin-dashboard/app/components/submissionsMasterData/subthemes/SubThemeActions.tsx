"use client";

import { useState } from "react";
import { PencilSquareIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/solid";
import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
} from "@/app/components/submissionsMasterData/api";
import type { SubThemeRow } from "./SubThemesTable";

type FormState = {
  name: string;
  description: string;
  isActive: boolean;
};

function toFormState(row?: SubThemeRow): FormState {
  return {
    name: row?.name ?? "",
    description: row?.description ?? "",
    isActive: row?.isActive ?? true,
  };
}

function SubThemeModal({
  isOpen,
  onClose,
  onSaved,
  programId,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  programId: string;
  initialData?: SubThemeRow;
}) {
  const isEditing = !!initialData;
  const [form, setForm] = useState<FormState>(toFormState(initialData));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSave() {
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError("Sub theme name is required.");
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setError("You must be signed in.");
      return;
    }

    const path = isEditing
      ? `/programs/subthemes/${encodeURIComponent(initialData!.id)}`
      : `/programs/${encodeURIComponent(programId)}/subthemes`;
    const method = isEditing ? "PUT" : "POST";
    const body = isEditing
      ? {
          name,
          description: form.description.trim() || undefined,
          isActive: form.isActive,
        }
      : {
          programId,
          name,
          description: form.description.trim() || undefined,
        };

    setSaving(true);
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
      setError(err instanceof Error ? err.message : "Failed to save sub theme.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditing ? "Edit Sub Theme" : "Add Sub Theme"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Update sub theme information used in the submission form.
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
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Sub Theme Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {isEditing && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status</label>
              <select
                value={form.isActive ? "Active" : "Inactive"}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === "Active" }))}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
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
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Sub Theme"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddSubThemeAction({
  programId,
  onChanged,
}: {
  programId: string;
  onChanged: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
      >
        <PlusIcon className="h-4 w-4" />
        <span>Add Sub Theme</span>
      </button>
      <SubThemeModal
        isOpen={isOpen}
        programId={programId}
        onClose={() => setIsOpen(false)}
        onSaved={onChanged}
      />
    </>
  );
}

export function EditSubThemeAction({
  subTheme,
  onChanged,
}: {
  subTheme: SubThemeRow;
  onChanged: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
        title="Edit sub theme"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <SubThemeModal
        isOpen={isOpen}
        programId={subTheme.programId}
        initialData={subTheme}
        onClose={() => setIsOpen(false)}
        onSaved={onChanged}
      />
    </>
  );
}

export function DeleteSubThemeAction({
  subTheme,
  onChanged,
}: {
  subTheme: SubThemeRow;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <button
      type="button"
      disabled={deleting}
      onClick={async () => {
        const token = getAccessToken();
        if (!token) return;
        if (!window.confirm(`Delete the sub theme "${subTheme.name}"?`)) return;

        setDeleting(true);
        try {
          const response = await fetch(
            buildApiUrl(`/programs/subthemes/${encodeURIComponent(subTheme.id)}`),
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (!response.ok) {
            const message = await readErrorMessage(response);
            alert(message);
            return;
          }
          onChanged();
        } finally {
          setDeleting(false);
        }
      }}
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
      title="Delete sub theme"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
