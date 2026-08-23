"use client";

import { useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import { buildApiUrl, getAccessToken, readErrorMessage, readJsonData } from "@/app/components/submissionsMasterData/api";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export interface ParticipationCategoryRow {
  id: string;
  name: string;
  programId?: string;
  description?: string;
  benefits?: string;
  eligibility?: string;
  order: number;
  isActive?: boolean;
  status: "Active" | "Inactive";
}

interface CategoryModalState {
  id?: string;
  name: string;
  description: string;
  benefits: string;
  eligibility: string;
  order: string;
  status: "Active" | "Inactive";
}

function createEmptyCategoryState(): CategoryModalState {
  return {
    name: "",
    description: "",
    benefits: "",
    eligibility: "",
    order: "0",
    status: "Active",
  };
}

function toCategoryState(category?: ParticipationCategoryRow): CategoryModalState {
  if (!category) {
    return createEmptyCategoryState();
  }

  return {
    id: category.id,
    name: category.name,
    description: category.description ?? "",
    benefits: category.benefits ?? "",
    eligibility: category.eligibility ?? "",
    order: String(category.order ?? 0),
    status: category.status,
  };
}

function normalizeRichText(value: string): string | undefined {
  const html = value.trim();
  if (!html) {
    return undefined;
  }

  const plain = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, "")
    .trim();

  return plain ? html : undefined;
}

function toPlainPreview(value?: string): string {
  if (!value) {
    return "-";
  }

  const text = value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text || "-";
}

function CategoryModal({
  isOpen,
  formState,
  onChange,
  onClose,
  onSubmit,
  isSaving,
  errorMessage,
}: {
  isOpen: boolean;
  formState: CategoryModalState;
  onChange: (patch: Partial<CategoryModalState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  errorMessage: string | null;
}) {
  const isEditing = Boolean(formState.id);

  return (
    <DrawerShell
      open={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Category" : "Add Category"}
      description="Update category information used in the submission form."
      error={errorMessage}
      locked={isSaving}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
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
        </>
      }
    >
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Category Name</label>
        <input
          type="text"
          value={formState.name}
          onChange={(event) => onChange({ name: event.target.value })}
          className={INPUT_CLS}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description</label>
        <RichTextEditor
          content={formState.description}
          onChange={(html) => onChange({ description: html })}
          placeholder="Describe this participation category..."
          className="[&_.ProseMirror]:min-h-[140px]"
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Benefits</label>
          <RichTextEditor
            content={formState.benefits}
            onChange={(html) => onChange({ benefits: html })}
            placeholder="Highlight category benefits..."
            className="[&_.ProseMirror]:min-h-[140px]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Eligibility</label>
          <RichTextEditor
            content={formState.eligibility}
            onChange={(html) => onChange({ eligibility: html })}
            placeholder="Define eligibility criteria..."
            className="[&_.ProseMirror]:min-h-[140px]"
          />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Display Order</label>
          <input
            type="number"
            value={formState.order}
            onChange={(event) => onChange({ order: event.target.value })}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status</label>
          <select
            value={formState.status}
            onChange={(event) => onChange({ status: event.target.value as "Active" | "Inactive" })}
            className={INPUT_CLS}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
    </DrawerShell>
  );
}

export function ParticipationCategoriesTable({ programId }: { programId: string }) {
  const resolvedProgramId = useResolvedProgramId(programId);
  const [data, setData] = useState<ParticipationCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<CategoryModalState>(createEmptyCategoryState());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);

  const loadCategories = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildApiUrl(`/programs/${encodeURIComponent(resolvedProgramId)}/participation-categories?includeInactive=true`), {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = await readJsonData<Array<{
        id: string;
        programId: string;
        name: string;
        description?: string;
        benefits?: string;
        eligibility?: string;
        order: number;
        isActive: boolean;
      }>>(response);

      setData(
        payload.map((item) => ({
          id: item.id,
          programId: item.programId,
          name: item.name,
          description: item.description,
          benefits: item.benefits,
          eligibility: item.eligibility,
          order: item.order,
          isActive: item.isActive,
          status: item.isActive ? "Active" : "Inactive",
        })),
      );
    } catch (error) {
      setData([]);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load categories.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, [resolvedProgramId]);

  const openCreateModal = () => {
    setFormState(createEmptyCategoryState());
    setModalErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (category: ParticipationCategoryRow) => {
    setFormState(toCategoryState(category));
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
      setModalErrorMessage("An admin access token is required to create or update categories.");
      return;
    }

    if (!formState.name.trim()) {
      setModalErrorMessage("Category name is required.");
      return;
    }

    const order = Number(formState.order || 0);
    if (Number.isNaN(order)) {
      setModalErrorMessage("Display order must be a valid number.");
      return;
    }

    const isEditing = Boolean(formState.id);
    const payload = {
      name: formState.name.trim(),
      description: normalizeRichText(formState.description),
      benefits: normalizeRichText(formState.benefits),
      eligibility: normalizeRichText(formState.eligibility),
      order,
      ...(isEditing ? { isActive: formState.status === "Active" } : { programId: resolvedProgramId, isActive: formState.status === "Active" }),
    };

    const path = isEditing
      ? `/programs/participation-categories/${encodeURIComponent(formState.id as string)}`
      : `/programs/${encodeURIComponent(resolvedProgramId)}/participation-categories`;

    setIsSaving(true);
    setModalErrorMessage(null);

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

      await loadCategories();
      closeModal();
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : "Failed to save category.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (category: ParticipationCategoryRow) => {
    const token = getAccessToken();
    if (!token) {
      setErrorMessage("An admin access token is required to delete categories.");
      return;
    }

    const isConfirmed = window.confirm(`Delete the category "${category.name}"?`);
    if (!isConfirmed) {
      return;
    }

    setDeletingId(category.id);
    setErrorMessage(null);

    try {
      const response = await fetch(buildApiUrl(`/programs/participation-categories/${encodeURIComponent(category.id)}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await loadCategories();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete category.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <UsersIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Participation Categories</h2>
            <p className="text-sm text-zinc-500">Define available participation categories for this program.</p>
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
          <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
            <PlusIcon className="h-4 w-4" />
            <span>Add Category</span>
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
                <th className="px-6 py-4 font-semibold">Category Name</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold">Benefits & Eligibility</th>
                <th className="px-6 py-4 font-semibold">Order</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Loading participation categories...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                    No participation categories configured yet.
                  </td>
                </tr>
              ) : (
                data.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                    <td className="px-6 py-4 align-top font-semibold text-zinc-900">{row.name}</td>
                    <td className="px-6 py-4 align-top text-zinc-600">{toPlainPreview(row.description)}</td>
                    <td className="px-6 py-4 align-top text-zinc-600">
                      <div className="space-y-1 text-xs">
                        <div><span className="font-semibold text-zinc-700">Benefits:</span> {toPlainPreview(row.benefits)}</div>
                        <div><span className="font-semibold text-zinc-700">Eligibility:</span> {toPlainPreview(row.eligibility)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-zinc-600">{row.order}</td>
                    <td className="px-6 py-4 align-top">
                      <span className={`inline-flex rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${row.status === "Active" ? " bg-emerald-50 text-emerald-700" : " bg-zinc-50 text-zinc-600"}`}>
                        {row.status}
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

      <CategoryModal
        isOpen={isModalOpen}
        formState={formState}
        onChange={(patch) => setFormState((current) => ({ ...current, ...patch }))}
        onClose={closeModal}
        onSubmit={() => void handleSave()}
        isSaving={isSaving}
        errorMessage={modalErrorMessage}
      />
      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="participation-categories"
        entityLabel="Participation Categories"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
          void loadCategories();
        }}
      />
    </section>
  );
}