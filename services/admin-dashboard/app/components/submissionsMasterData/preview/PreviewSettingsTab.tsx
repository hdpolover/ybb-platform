"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
  readJsonData,
} from "@/app/components/submissionsMasterData/api";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";

type ProgramPreviewSettings = {
  id: string;
  name: string;
  termsAndConditions?: string | null;
  previewChecklistItems?: string[] | null;
};

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

export function PreviewSettingsTab({ programId }: { programId: string }) {
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const newItemRef = useRef<HTMLInputElement>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const token = getAccessToken();
      const response = await fetch(
        buildApiUrl(`/admin/programs/${encodeURIComponent(programId)}`),
        {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = await readJsonData<ProgramPreviewSettings>(response);
      setTermsAndConditions(payload.termsAndConditions ?? "");
      setChecklistItems(Array.isArray(payload.previewChecklistItems) ? payload.previewChecklistItems : []);
    } catch (error) {
      setTermsAndConditions("");
      setChecklistItems([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load preview settings.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed || checklistItems.includes(trimmed)) return;
    setChecklistItems(prev => [...prev, trimmed]);
    setNewItem("");
    newItemRef.current?.focus();
  };

  const removeItem = (index: number) => {
    setChecklistItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const token = getAccessToken();
    if (!token) {
      setErrorMessage("An admin access token is required to update preview settings.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        buildApiUrl(`/programs/${encodeURIComponent(programId)}`),
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            termsAndConditions: normalizeRichText(termsAndConditions),
            previewChecklistItems: checklistItems.length > 0 ? checklistItems : null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await response.json();
      await loadSettings();
      setSuccessMessage("Preview settings saved successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save preview settings.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <EyeIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Preview Step Settings</h2>
            <p className="text-sm text-zinc-500">
              Manage content shown in the final Preview & Confirmation step.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || isLoading}
          className="inline-flex items-center gap-2 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Preview"}
        </button>
      </div>

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Disclaimer Content</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Participants must read this before submitting. Shown as a disclaimer block on the preview step.
            </p>
          </div>

          {isLoading ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
              Loading preview settings...
            </div>
          ) : (
            <RichTextEditor
              content={termsAndConditions}
              onChange={(html) => {
                setTermsAndConditions(html);
                if (successMessage) setSuccessMessage(null);
              }}
              placeholder="Enter disclaimer content shown on the preview step..."
              className="[&_.ProseMirror]:min-h-[260px]"
            />
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Required Checklist</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Participants must check all items before they can submit.
            </p>
          </div>

          {isLoading ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500">
              Loading...
            </div>
          ) : (
            <div className="space-y-2">
              {checklistItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-400">
                  No checklist items yet. Add one below.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {checklistItems.map((item, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                    >
                      <span className="flex-1">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="mt-0.5 shrink-0 text-zinc-400 transition hover:text-red-500"
                        aria-label="Remove item"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <input
                  ref={newItemRef}
                  type="text"
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                  placeholder="Add a checklist item..."
                  className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!newItem.trim()}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-600">
            <p className="font-semibold text-zinc-700">Primary CTA behavior</p>
            <p className="mt-1">
              If registration payment is required and unpaid, participants will see a payment CTA first.
            </p>
            <p className="mt-1">
              Once all checklist items are confirmed and payment is settled, participants can submit.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
