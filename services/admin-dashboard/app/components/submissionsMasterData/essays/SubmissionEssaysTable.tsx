"use client";

import { useEffect, useState } from "react";
import {
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import { buildApiUrl, getAccessToken, readErrorMessage, readJsonData } from "@/app/components/submissionsMasterData/api";

export interface SubmissionEssayRow {
  id: string;
  question: string;
  description?: string;
  wordLimit?: number;
  isRequired?: boolean;
  order: number;
  isActive?: boolean;
  status: "Active" | "Inactive";
}

interface EssayModalState {
  id?: string;
  question: string;
  description: string;
  wordLimit: string;
  isRequired: boolean;
  order: string;
  status: "Active" | "Inactive";
}

function createEmptyEssayState(): EssayModalState {
  return {
    question: "",
    description: "",
    wordLimit: "",
    isRequired: false,
    order: "0",
    status: "Active",
  };
}

function toEssayState(essay?: SubmissionEssayRow): EssayModalState {
  if (!essay) {
    return createEmptyEssayState();
  }

  return {
    id: essay.id,
    question: essay.question,
    description: essay.description ?? "",
    wordLimit: typeof essay.wordLimit === "number" ? String(essay.wordLimit) : "",
    isRequired: essay.isRequired ?? false,
    order: String(essay.order ?? 0),
    status: essay.status,
  };
}

function EssayModal({
  isOpen,
  formState,
  onChange,
  onClose,
  onSubmit,
  isSaving,
  errorMessage,
}: {
  isOpen: boolean;
  formState: EssayModalState;
  onChange: (patch: Partial<EssayModalState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  errorMessage: string | null;
}) {
  if (!isOpen) return null;
  const isEditing = Boolean(formState.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditing ? "Edit Essay" : "Add Essay"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Update essay question configuration for this program.
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="space-y-5 px-6 py-6 text-left">
          {errorMessage ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Essay Question</label>
            <textarea
              rows={4}
              value={formState.question}
              onChange={(event) => onChange({ question: event.target.value })}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description</label>
            <textarea
              rows={3}
              value={formState.description}
              onChange={(event) => onChange({ description: event.target.value })}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Word Limit</label>
              <input
                type="number"
                value={formState.wordLimit}
                onChange={(event) => onChange({ wordLimit: event.target.value })}
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
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status</label>
              <select
                value={formState.status}
                onChange={(event) => onChange({ status: event.target.value as "Active" | "Inactive" })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">Cancel</button>
          <button type="button" onClick={onSubmit} disabled={isSaving} className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

export function SubmissionEssaysTable({ programId }: { programId: string }) {
  const [data, setData] = useState<SubmissionEssayRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<EssayModalState>(createEmptyEssayState());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEssays = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildApiUrl(`/programs/${encodeURIComponent(programId)}/essays?includeInactive=true`), {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = await readJsonData<Array<{
        id: string;
        question: string;
        description?: string;
        wordLimit?: number;
        isRequired: boolean;
        order: number;
        isActive: boolean;
      }>>(response);

      setData(
        payload.map((item) => ({
          id: item.id,
          question: item.question,
          description: item.description,
          wordLimit: item.wordLimit,
          isRequired: item.isRequired,
          order: item.order,
          isActive: item.isActive,
          status: item.isActive ? "Active" : "Inactive",
        })),
      );
    } catch (error) {
      setData([]);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load essays.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadEssays();
  }, [programId]);

  const openCreateModal = () => {
    setFormState(createEmptyEssayState());
    setModalErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (essay: SubmissionEssayRow) => {
    setFormState(toEssayState(essay));
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
      setModalErrorMessage("An admin access token is required to create or update essays.");
      return;
    }

    if (!formState.question.trim()) {
      setModalErrorMessage("Essay question is required.");
      return;
    }

    const order = Number(formState.order || 0);
    if (Number.isNaN(order)) {
      setModalErrorMessage("Display order must be a valid number.");
      return;
    }

    const parsedWordLimit = formState.wordLimit.trim() ? Number(formState.wordLimit) : undefined;
    if (typeof parsedWordLimit === "number" && Number.isNaN(parsedWordLimit)) {
      setModalErrorMessage("Word limit must be a valid number.");
      return;
    }

    const payload = {
      programId,
      question: formState.question.trim(),
      description: formState.description.trim() || undefined,
      wordLimit: parsedWordLimit,
      isRequired: formState.isRequired,
      order,
      isActive: formState.status === "Active",
    };

    const isEditing = Boolean(formState.id);
    const path = isEditing
      ? `/programs/essays/${encodeURIComponent(formState.id as string)}`
      : `/programs/${encodeURIComponent(programId)}/essays`;

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

      await loadEssays();
      closeModal();
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : "Failed to save essay.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (essay: SubmissionEssayRow) => {
    const token = getAccessToken();
    if (!token) {
      setErrorMessage("An admin access token is required to delete essays.");
      return;
    }

    const isConfirmed = window.confirm("Delete this essay question?");
    if (!isConfirmed) {
      return;
    }

    setDeletingId(essay.id);
    setErrorMessage(null);

    try {
      const response = await fetch(buildApiUrl(`/programs/essays/${encodeURIComponent(essay.id)}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await loadEssays();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete essay.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <DocumentTextIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Essays</h2>
            <p className="text-sm text-zinc-500">Configure essay questions used in the submission form.</p>
          </div>
        </div>
        <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
          <PlusIcon className="h-4 w-4" />
          <span>Add Essay</span>
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
                <th className="px-6 py-4 font-semibold">Essay Question</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="w-32 px-6 py-4 font-semibold">Word Limit</th>
                <th className="w-28 px-6 py-4 font-semibold">Order</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Loading essays...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                    No essay questions configured yet.
                  </td>
                </tr>
              ) : (
                data.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                    <td className="px-6 py-4 align-top font-medium text-zinc-900">{row.question}</td>
                    <td className="px-6 py-4 align-top text-zinc-600">{row.description || "-"}</td>
                    <td className="px-6 py-4 align-top text-zinc-600">{row.wordLimit ? `${row.wordLimit} words` : "-"}</td>
                    <td className="px-6 py-4 align-top text-zinc-600">{row.order}</td>
                    <td className="px-6 py-4 align-top">
                      <span className={`inline-flex rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${row.status === "Active" ? " bg-emerald-50 text-emerald-700" : " bg-zinc-50 text-zinc-600"}`}>
                        {row.isRequired ? `${row.status} / Required` : row.status}
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

      <EssayModal
        isOpen={isModalOpen}
        formState={formState}
        onChange={(patch) => setFormState((current) => ({ ...current, ...patch }))}
        onClose={closeModal}
        onSubmit={() => void handleSave()}
        isSaving={isSaving}
        errorMessage={modalErrorMessage}
      />
    </section>
  );
}