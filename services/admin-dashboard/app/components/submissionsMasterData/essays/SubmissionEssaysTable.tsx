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
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";
import { CategoryScopeBadge, CATEGORY_SCOPE_OPTIONS } from "@/app/components/submissionsMasterData/CategoryScopeBadge";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export interface SubmissionEssayRow {
  id: string;
  question: string;
  description?: string;
  wordLimit?: number;
  isRequired?: boolean;
  order: number;
  isActive?: boolean;
  status: "Active" | "Inactive";
  allowedCategories?: string[];
}

interface EssayModalState {
  id?: string;
  question: string;
  description: string;
  wordLimit: string;
  isRequired: boolean;
  order: string;
  status: "Active" | "Inactive";
  /** '' = all categories; otherwise a single ApplicationCategory value. */
  categoryScope: string;
}

function createEmptyEssayState(): EssayModalState {
  return {
    question: "",
    description: "",
    wordLimit: "",
    isRequired: false,
    order: "0",
    status: "Active",
    categoryScope: "",
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
    categoryScope: essay.allowedCategories?.[0] ?? "",
  };
}

interface GuidelineModalState {
  text: string;
  url: string;
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
    return "";
  }

  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const isEditing = Boolean(formState.id);

  return (
    <DrawerShell
      open={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Essay" : "Add Essay"}
      description="Update essay question configuration for this program."
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
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Essay Question</label>
        <textarea
          rows={4}
          value={formState.question}
          onChange={(event) => onChange({ question: event.target.value })}
          className={INPUT_CLS}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description</label>
        <textarea
          rows={3}
          value={formState.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className={INPUT_CLS}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Word Limit</label>
          <input
            type="number"
            value={formState.wordLimit}
            onChange={(event) => onChange({ wordLimit: event.target.value })}
            className={INPUT_CLS}
          />
        </div>
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
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Required</label>
          <select
            value={formState.isRequired ? "true" : "false"}
            onChange={(event) => onChange({ isRequired: event.target.value === "true" })}
            className={INPUT_CLS}
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
            className={INPUT_CLS}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Category Scope</label>
          <select
            value={formState.categoryScope}
            onChange={(event) => onChange({ categoryScope: event.target.value })}
            className={INPUT_CLS}
          >
            {CATEGORY_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </DrawerShell>
  );
}

function EssayGuidelineModal({
  isOpen,
  formState,
  onChange,
  onClose,
  onSubmit,
  isSaving,
  errorMessage,
}: {
  isOpen: boolean;
  formState: GuidelineModalState;
  onChange: (patch: Partial<GuidelineModalState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  errorMessage: string | null;
}) {
  return (
    <DrawerShell
      open={isOpen}
      onClose={onClose}
      title="Essay Guidelines"
      description="Set shared guideline text and link shown once in Entry Information."
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
            {isSaving ? "Saving..." : "Save Guidelines"}
          </button>
        </>
      }
    >
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Guideline Text</label>
        <RichTextEditor
          content={formState.text}
          onChange={(html) => onChange({ text: html })}
          placeholder="Optional guidance shown above the essay questions section"
          className="[&_.ProseMirror]:min-h-[160px]"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Guideline Link (URL)</label>
        <input
          type="url"
          value={formState.url}
          onChange={(event) => onChange({ url: event.target.value })}
          placeholder="https://example.com/essay-guidelines"
          className={INPUT_CLS}
        />
      </div>
    </DrawerShell>
  );
}

export function SubmissionEssaysTable({ programId }: { programId: string }) {
  const resolvedProgramId = useResolvedProgramId(programId);
  const [data, setData] = useState<SubmissionEssayRow[]>([]);
  const [copyTemplateOpen, setCopyTemplateOpen] = useState(false);
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<EssayModalState>(createEmptyEssayState());
  const [isGuidelineModalOpen, setIsGuidelineModalOpen] = useState(false);
  const [guidelineState, setGuidelineState] = useState<GuidelineModalState>({ text: "", url: "" });
  const [guidelineErrorMessage, setGuidelineErrorMessage] = useState<string | null>(null);
  const [isSavingGuideline, setIsSavingGuideline] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEssays = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const essaysResponse = await fetch(
        buildApiUrl(`/programs/${encodeURIComponent(resolvedProgramId)}/essays?includeInactive=true`),
        {
          cache: "no-store",
        },
      );

      if (!essaysResponse.ok) {
        throw new Error(await readErrorMessage(essaysResponse));
      }

      const payload = await readJsonData<Array<{
        id: string;
        question: string;
        description?: string;
        wordLimit?: number;
        isRequired: boolean;
        order: number;
        isActive: boolean;
        guidelineText?: string;
        guidelineUrl?: string;
      }>>(essaysResponse);

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

      const guidelinesResponse = await fetch(
        buildApiUrl(`/programs/${encodeURIComponent(resolvedProgramId)}/essay-guidelines`),
        {
          cache: "no-store",
        },
      );

      if (guidelinesResponse.ok) {
        const guidelinesPayload = await readJsonData<{
          guidelineText?: string;
          guidelineUrl?: string;
        }>(guidelinesResponse);
        setGuidelineState({
          text: guidelinesPayload.guidelineText ?? "",
          url: guidelinesPayload.guidelineUrl ?? "",
        });
      } else if (guidelinesResponse.status === 404) {
        // Backward compatibility for API deployments that still keep guidelines per essay item.
        const legacySource = payload.find((item) => item.guidelineText || item.guidelineUrl);
        setGuidelineState({
          text: legacySource?.guidelineText ?? "",
          url: legacySource?.guidelineUrl ?? "",
        });
      } else {
        throw new Error(await readErrorMessage(guidelinesResponse));
      }
    } catch (error) {
      setData([]);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load essays.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadEssays();
  }, [resolvedProgramId]);

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

    const isEditing = Boolean(formState.id);

    const payload = {
      ...(isEditing ? {} : { programId: resolvedProgramId }),
      question: formState.question.trim(),
      description: formState.description.trim() || undefined,
      wordLimit: parsedWordLimit,
      isRequired: formState.isRequired,
      order,
      isActive: formState.status === "Active",
    };
    const path = isEditing
      ? `/programs/essays/${encodeURIComponent(formState.id as string)}`
      : `/programs/${encodeURIComponent(resolvedProgramId)}/essays`;

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

  const saveGuidelines = async () => {
    const token = getAccessToken();
    if (!token) {
      setGuidelineErrorMessage("An admin access token is required to update essay guidelines.");
      return;
    }
    const guidelineText = normalizeRichText(guidelineState.text);
    const guidelineUrl = guidelineState.url.trim();
    if (guidelineUrl) {
      try {
        new URL(guidelineUrl);
      } catch {
        setGuidelineErrorMessage("Guideline link must be a valid URL.");
        return;
      }
    }

    setIsSavingGuideline(true);
    setGuidelineErrorMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(
        buildApiUrl(`/programs/${encodeURIComponent(resolvedProgramId)}/essay-guidelines`),
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            guidelineText: guidelineText || undefined,
            guidelineUrl: guidelineUrl || undefined,
          }),
        },
      );

      // The 404 compatibility branch that used to live here has been removed.
      //
      // It existed for API deployments that kept guidelines on each essay item
      // rather than on the programme, and it fell back to one
      // PUT /programs/essays/:essayId per essay. The guarded
      // /programs/:id/essay-guidelines route has long since shipped, so the
      // branch was dead weight - and it had become dangerous.
      //
      // assertProgramAccess now answers 404 rather than 403 for a programme
      // outside the caller's scope, so that a scoped admin cannot tell "does not
      // exist" from "not yours". That made this branch fire on a REFUSAL. Its
      // only guard was `data.length === 0`, which is false because
      // GET /programs/:id/essays is @Public() and had already filled the table.
      // So a denied edit of another brand's guidelines turned into a completed
      // per-essay overwrite of that brand's entire essay set - question,
      // description, word limit, required flag, order and active flag, not just
      // the guideline text.
      //
      // Every non-ok response now takes the generic error path. Do not
      // reintroduce a status-sniffing fallback here: the API is the only place
      // that can tell a real 404 from a refusal, and it deliberately no longer
      // does.
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await loadEssays();
      setIsGuidelineModalOpen(false);
    } catch (error) {
      setGuidelineErrorMessage(
        error instanceof Error ? error.message : "Failed to save essay guidelines.",
      );
    } finally {
      setIsSavingGuideline(false);
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

  const guidelineTextPreview = toPlainPreview(normalizeRichText(guidelineState.text));
  const guidelineUrlPreview = guidelineState.url.trim();

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setGuidelineErrorMessage(null);
              setIsGuidelineModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <PencilSquareIcon className="h-4 w-4" />
            <span>Essay Guidelines</span>
          </button>
          <button
            type="button"
            onClick={() => setCopyTemplateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <span>Copy from Template</span>
          </button>
          <button
            type="button"
            onClick={() => setCopyFromProgramOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <span>Copy from Program</span>
          </button>
          <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
            <PlusIcon className="h-4 w-4" />
            <span>Add Essay</span>
          </button>
        </div>
      </div>

      {(guidelineTextPreview || guidelineUrlPreview) && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Shared Essay Guidelines</p>
          {guidelineTextPreview ? <p className="mt-1">{guidelineTextPreview}</p> : null}
          {guidelineUrlPreview && (
            <a
              href={guidelineUrlPreview}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 font-semibold text-blue-700 underline-offset-2 hover:underline"
            >
              {guidelineUrlPreview}
            </a>
          )}
        </div>
      )}

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
      <EssayGuidelineModal
        isOpen={isGuidelineModalOpen}
        formState={guidelineState}
        onChange={(patch) => setGuidelineState((current) => ({ ...current, ...patch }))}
        onClose={() => {
          setIsGuidelineModalOpen(false);
          setGuidelineErrorMessage(null);
        }}
        onSubmit={() => void saveGuidelines()}
        isSaving={isSavingGuideline}
        errorMessage={guidelineErrorMessage}
      />
      <CopyFromTemplateDialog
        open={copyTemplateOpen}
        entityKey="essays"
        entityLabel="Essays"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyTemplateOpen(false)}
        onApplied={() => {
          setCopyTemplateOpen(false);
          void loadEssays();
        }}
      />
      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="essays"
        entityLabel="Essays"
        programId={resolvedProgramId}
        supportsAppend
        replaceCaveat="Answers participants have already written are kept, but may no longer match the new questions."
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
          void loadEssays();
        }}
      />
    </section>
  );
}
