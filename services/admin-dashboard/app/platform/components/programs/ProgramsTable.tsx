"use client";

import { Pencil, Trash2, Eye, Layers, TriangleAlert } from "lucide-react";
import Link from "next/link";
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
import { StatusBadge } from "@/src/admin/status-badge";
import { formatDate } from "@/lib/utils";

export type Program = {
  id: string;
  name: string;
  description: string | null;
  brandId: string;
  brandName: string;
  slug: string;
  year: number;
  status: "draft" | "published" | "ongoing" | "completed" | "cancelled";
  applicationDeadline: string;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProgramsTableProps = {
  programs: Program[];
  onEdit: (program: Program) => void;
  onDelete: (program: Program) => void;
};

export function ProgramsTable({ programs, onEdit, onDelete }: ProgramsTableProps) {
  if (programs.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No programs yet"
        description="Get started by creating your first program."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Program</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Year</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Visibility</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {programs.map((program) => (
          <TableRow key={program.id}>
            <TableCell>
              <div>
                <p className="font-semibold text-zinc-900">{program.name}</p>
                <p className="font-mono text-[10px] text-zinc-400">{program.slug}</p>
              </div>
            </TableCell>
            <TableCell>
              <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {program.brandName}
              </span>
            </TableCell>
            <TableCell className="text-zinc-600">{program.year}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={program.status} context="generic" />
                {program.status === "draft" && (program.isPublished || program.isActive) && (
                  <span
                    title='Status is "Draft" but Published/Active is on — every public query hides draft programs, so this is invisible on the site despite looking live here.'
                    className="inline-flex text-amber-500"
                  >
                    <TriangleAlert className="h-4 w-4" />
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-zinc-500">
              {program.applicationDeadline
                ? formatDate(program.applicationDeadline)
                : "—"}
            </TableCell>
            <TableCell className="text-xs text-zinc-500">
              {program.startDate ? formatDate(program.startDate) : "—"}
              {" → "}
              {program.endDate ? formatDate(program.endDate) : "—"}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                <StatusBadge
                  status={program.isPublished ? "published" : "draft"}
                  context="generic"
                />
                <StatusBadge
                  status={program.isActive ? "active" : "inactive"}
                  context="generic"
                />
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Link
                  href={`/programs/${program.id}`}
                  title="Open program workspace"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEdit(program)}
                  title="Edit program"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(program)}
                  title="Delete program"
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
