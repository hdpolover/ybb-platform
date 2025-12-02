"use client";

import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

export type Category = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  programCount: number;
  createdAt: string;
  updatedAt: string;
};

type CategoriesTableProps = {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
};

export function CategoriesTable({
  categories,
  onEdit,
  onDelete,
}: CategoriesTableProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
          <svg
            className="h-8 w-8 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-zinc-900">
          No categories yet
        </h3>
        <p className="text-sm text-zinc-600">
          Get started by creating your first program category
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Slug
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Programs
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Updated
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {categories.map((category) => (
              <tr
                key={category.id}
                className="transition-colors hover:bg-zinc-50"
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-zinc-900">
                    {category.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    {category.slug}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-xs truncate text-sm text-zinc-600">
                    {category.description || "—"}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-zinc-900">
                    {category.programCount}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">
                  {new Date(category.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(category)}
                      className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-blue-600"
                      title="Edit category"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(category)}
                      className="rounded-md p-2 text-zinc-600 hover:bg-red-50 hover:text-red-600"
                      title="Delete category"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
