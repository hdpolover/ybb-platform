"use client";

import { useState } from "react";
import type { Program } from "./ProgramsTable";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";

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

  const generateSlug = (name: string): string =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>{program ? "Edit Program" : "Create Program"}</SheetTitle>
          <SheetDescription>
            {program
              ? "Update this program shell. Fees, capacity, and registration windows are managed inside the program workspace."
              : "Create a new program shell. Additional settings are configured inside the program workspace."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-1 flex-col gap-6">
          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Basic Information */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Basic Information
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="prog-name">
                  Program Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="prog-name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Summer Leadership Camp 2025"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="prog-brand">
                  Brand <span className="text-red-500">*</span>
                </Label>
                <select
                  id="prog-brand"
                  value={formData.brandId}
                  onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  required
                >
                  <option value="">Select a brand</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="prog-year">
                  Year <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  id="prog-year"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                  min="2000"
                  max="2100"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="prog-status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <select
                  id="prog-status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as ProgramFormData["status"] })
                  }
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  required
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="prog-slug">
                  Slug <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-1.5">
                  <Input
                    id="prog-slug"
                    value={formData.slug}
                    onChange={(e) => {
                      setFormData({ ...formData, slug: e.target.value });
                      setAutoGenerateSlug(false);
                    }}
                    placeholder="summer-leadership-camp-2025"
                    pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                    required
                  />
                  <label className="flex items-center gap-2 text-xs text-zinc-500">
                    <input
                      type="checkbox"
                      checked={autoGenerateSlug}
                      onChange={(e) => {
                        setAutoGenerateSlug(e.target.checked);
                        if (e.target.checked) {
                          setFormData((prev) => ({ ...prev, slug: generateSlug(prev.name) }));
                        }
                      }}
                      className="rounded border-zinc-300"
                    />
                    Auto-generate from name
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="prog-description">Description</Label>
                <textarea
                  id="prog-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  placeholder="Provide a detailed description of the program…"
                />
              </div>

              <div className="sm:col-span-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Program-specific settings like fees, capacity, registration windows, and venue details are managed inside the program admin workspace.
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={formData.isPublished}
                  onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                  className="rounded border-zinc-300"
                />
                Publish after save
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-zinc-300"
                />
                Mark program as active
              </label>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Schedule</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="prog-deadline">
                  Application Deadline <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  id="prog-deadline"
                  value={formData.applicationDeadline}
                  onChange={(e) => setFormData({ ...formData, applicationDeadline: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prog-start">Start Date</Label>
                <Input
                  type="date"
                  id="prog-start"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prog-end">End Date</Label>
                <Input
                  type="date"
                  id="prog-end"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="mt-auto flex justify-end gap-3 border-t border-zinc-200 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {program ? "Update Program" : "Create Program"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
