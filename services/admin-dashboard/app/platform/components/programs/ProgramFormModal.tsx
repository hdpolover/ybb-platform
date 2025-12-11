"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import type { Program } from "./ProgramsTable";

type ProgramFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProgramFormData) => void;
  program?: Program | null;
  categories: Array<{ id: string; name: string }>;
};

export type ProgramFormData = {
  name: string;
  description: string;
  categoryId: string;
  slug: string;
  status: "draft" | "published" | "archived";
  registrationStartDate: string;
  registrationEndDate: string;
  programStartDate: string;
  programEndDate: string;
  registrationFee: number;
  maxParticipants: number | null;
};

export function ProgramFormModal({
  isOpen,
  onClose,
  onSubmit,
  program,
  categories,
}: ProgramFormModalProps) {
  const [formData, setFormData] = useState<ProgramFormData>(() => ({
    name: program?.name ?? "",
    description: program?.description ?? "",
    categoryId: program?.categoryId ?? categories[0]?.id ?? "",
    slug: program?.slug ?? "",
    status: program?.status ?? "draft",
    registrationStartDate: program?.registrationStartDate ?? "",
    registrationEndDate: program?.registrationEndDate ?? "",
    programStartDate: program?.programStartDate ?? "",
    programEndDate: program?.programEndDate ?? "",
    registrationFee: program?.registrationFee ?? 0,
    maxParticipants: program?.maxParticipants ?? null,
  }));
  const [autoGenerateSlug, setAutoGenerateSlug] = useState(() => !program);

  if (!isOpen) return null;

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: autoGenerateSlug ? generateSlug(name) : prev.slug,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            {program ? "Edit Program" : "Create Program"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Basic Information
              </h3>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Name */}
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="name"
                      className="mb-1 block text-sm font-medium text-zinc-700"
                    >
                      Program Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g., Summer Leadership Camp 2025"
                      required
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label
                      htmlFor="categoryId"
                      className="mb-1 block text-sm font-medium text-zinc-700"
                    >
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="categoryId"
                      value={formData.categoryId}
                      onChange={(e) =>
                        setFormData({ ...formData, categoryId: e.target.value })
                      }
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label
                      htmlFor="status"
                      className="mb-1 block text-sm font-medium text-zinc-700"
                    >
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as "draft" | "published" | "archived",
                        })
                      }
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  {/* Slug */}
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="slug"
                      className="mb-1 block text-sm font-medium text-zinc-700"
                    >
                      Slug <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => {
                          setFormData({ ...formData, slug: e.target.value });
                          setAutoGenerateSlug(false);
                        }}
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="summer-leadership-camp-2025"
                        pattern="[a-z0-9-]+"
                        required
                      />
                      <label className="flex items-center gap-2 text-xs text-zinc-600">
                        <input
                          type="checkbox"
                          checked={autoGenerateSlug}
                          onChange={(e) => {
                            setAutoGenerateSlug(e.target.checked);
                            if (e.target.checked) {
                              setFormData((prev) => ({
                                ...prev,
                                slug: generateSlug(prev.name),
                              }));
                            }
                          }}
                          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        Auto-generate from name
                      </label>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="description"
                      className="mb-1 block text-sm font-medium text-zinc-700"
                    >
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={4}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Provide a detailed description of the program..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Registration Dates */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Registration Period
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="registrationStartDate"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Registration Start Date
                  </label>
                  <input
                    type="date"
                    id="registrationStartDate"
                    value={formData.registrationStartDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        registrationStartDate: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="registrationEndDate"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Registration End Date
                  </label>
                  <input
                    type="date"
                    id="registrationEndDate"
                    value={formData.registrationEndDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        registrationEndDate: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Program Dates */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Program Duration
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="programStartDate"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Program Start Date
                  </label>
                  <input
                    type="date"
                    id="programStartDate"
                    value={formData.programStartDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        programStartDate: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="programEndDate"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Program End Date
                  </label>
                  <input
                    type="date"
                    id="programEndDate"
                    value={formData.programEndDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        programEndDate: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Fees & Capacity */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Fees & Capacity
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="registrationFee"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Registration Fee (USD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="registrationFee"
                    value={formData.registrationFee}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        registrationFee: Number(e.target.value),
                      })
                    }
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="maxParticipants"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Max Participants
                  </label>
                  <input
                    type="number"
                    id="maxParticipants"
                    value={formData.maxParticipants || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxParticipants: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    min="1"
                    placeholder="Unlimited"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Leave empty for unlimited capacity
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3 border-t border-zinc-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {program ? "Update Program" : "Create Program"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
