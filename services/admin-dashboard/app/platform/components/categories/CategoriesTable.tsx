"use client";

import { Pencil, Trash2, FolderOpen } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";
import { Button } from "@/src/ui/button";
import { EmptyState } from "@/src/admin/empty-state";
import { formatDate } from "@/lib/utils";

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

export function CategoriesTable({ categories, onEdit, onDelete }: CategoriesTableProps) {
  if (categories.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No brands yet"
        description="Get started by creating your first brand."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Brand</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Programs</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.id}>
            <TableCell className="font-semibold text-zinc-900">{category.name}</TableCell>
            <TableCell>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
                {category.slug}
              </span>
            </TableCell>
            <TableCell className="max-w-xs truncate text-zinc-600">
              {category.description ?? "—"}
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {category.programCount}
              </span>
            </TableCell>
            <TableCell className="text-zinc-500">
              {formatDate(category.updatedAt)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEdit(category)}
                  title="Edit brand"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(category)}
                  title="Delete brand"
                  className="text-red-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
