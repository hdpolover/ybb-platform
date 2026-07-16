"use client";

import { useState } from "react";
import type { Category } from "./CategoriesTable";
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

type CategoryFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => void | Promise<void>;
  category?: Category | null;
  isSubmitting?: boolean;
  errorMessage?: string | null;
};

export type CategoryFormData = {
  name: string;
  description: string;
  slug: string;
};

export function CategoryFormModal({
  isOpen,
  onClose,
  onSubmit,
  category,
  isSubmitting = false,
  errorMessage,
}: CategoryFormModalProps) {
  const [formData, setFormData] = useState<CategoryFormData>(() => ({
    name: category?.name ?? "",
    description: category?.description ?? "",
    slug: category?.slug ?? "",
  }));
  const [autoGenerateSlug, setAutoGenerateSlug] = useState(() => !category);

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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{category ? "Edit Brand" : "Create Brand"}</SheetTitle>
          <SheetDescription>
            {category
              ? "Update the brand details and slug."
              : "Create a new brand to group your programs under a common identity."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-1 flex-col gap-4">
          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="brand-name">
              Brand Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="brand-name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Istanbul Youth Summit"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="brand-slug">
              Slug <span className="text-red-500">*</span>
            </Label>
            <div className="space-y-1.5">
              <Input
                id="brand-slug"
                value={formData.slug}
                onChange={(e) => {
                  setFormData({ ...formData, slug: e.target.value });
                  setAutoGenerateSlug(false);
                }}
                placeholder="youth-leadership"
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

          <div className="space-y-1">
            <Label htmlFor="brand-description">Description</Label>
            <textarea
              id="brand-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              placeholder="Brief description of this brand…"
            />
          </div>

          <div className="mt-auto flex justify-end gap-3 border-t border-zinc-200 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {category ? "Update Brand" : "Create Brand"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
