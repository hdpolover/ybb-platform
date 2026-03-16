"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import type { Program } from "./ProgramsTable";

type ProgramFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProgramFormData) => void | Promise<void>;
  program?: Program | null;
  categories: Array<{ id: string; name: string }>;
  isSubmitting?: boolean;
  errorMessage?: string | null;
};

export type ProgramFormData = {
  brandId: string;
  name: string;
  description: string;
  slug: string;
  year: number;
  status: "draft" | "published" | "ongoing" | "completed" | "cancelled";
  applicationDeadline: string;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  isActive: boolean;
};

export function ProgramFormModal({
  isOpen,
  onClose,
  onSubmit,
  program,
  categories,
  isSubmitting = false,
  errorMessage,
}: ProgramFormModalProps) {
  const [formData, setFormData] = useState<ProgramFormData>(() => ({
    brandId: program?.brandId ?? categories[0]?.id ?? "",
    name: program?.name ?? "",
    description: program?.description ?? "",
    slug: program?.slug ?? "",
    year: program?.year ?? new Date().getFullYear(),
    status: program?.status ?? "draft",
    applicationDeadline: program?.applicationDeadline?.slice(0, 10) ?? "",
    startDate: program?.startDate?.slice(0, 10) ?? "",
    endDate: program?.endDate?.slice(0, 10) ?? "",
    isPublished: program?.isPublished ?? false,
    isActive: program?.isActive ?? true,
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Bagian header modal */}
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

        {/* Isi form utama */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {errorMessage ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {/* Bagian informasi dasar program */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Basic Information
              </h3>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Input nama program */}
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

                  {/* Dropdown kategori program */}
                  <div>
                    <label
                      htmlFor="brandId"
                      className="mb-1 block text-sm font-medium text-zinc-700"
                    >
                      Brand <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="brandId"
                      value={formData.brandId}
                      onChange={(e) =>
                        setFormData({ ...formData, brandId: e.target.value })
                      }
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a brand</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="year"
                      className="mb-1 block text-sm font-medium text-zinc-700"
                    >
                      Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="year"
                      value={formData.year}
                      onChange={(e) =>
                        setFormData({ ...formData, year: Number(e.target.value) })
                      }
                      min="2000"
                      max="2100"
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>

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
                          status: e.target.value as ProgramFormData["status"],
                        })
                      }
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Input slug buat URL program */}
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
                        pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
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

                  <div className="sm:col-span-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Program-specific settings like fees, capacity, registration windows, and venue details are managed inside the program admin area.
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={formData.isPublished}
                        onChange={(e) =>
                          setFormData({ ...formData, isPublished: e.target.checked })
                        }
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      Publish after save
                    </label>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData({ ...formData, isActive: e.target.checked })
                        }
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      Mark program as active
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Schedule
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="applicationDeadline"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Application Deadline <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="applicationDeadline"
                    value={formData.applicationDeadline}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        applicationDeadline: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="startDate"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Program Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="endDate"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Program End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

            {/* Tombol aksi di bagian bawah form */}
          <div className="mt-6 flex justify-end gap-3 border-t border-zinc-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {isSubmitting
                ? (program ? "Updating..." : "Creating...")
                : (program ? "Update Program" : "Create Program")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
