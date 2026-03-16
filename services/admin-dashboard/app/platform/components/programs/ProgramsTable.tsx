"use client";

import { PencilIcon, TrashIcon, EyeIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

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

const statusColors = {
  draft: "bg-zinc-100 text-zinc-700",
  published: "bg-green-100 text-green-700",
  ongoing: "bg-blue-100 text-blue-700",
  completed: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};

export function ProgramsTable({
  programs,
  onEdit,
  onDelete,
}: ProgramsTableProps) {
  if (programs.length === 0) {
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-zinc-900">
          No programs yet
        </h3>
        <p className="text-sm text-zinc-600">
          Get started by creating your first program
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
                Program Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Brand
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Year
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Application Deadline
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Program Dates
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                Visibility
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {programs.map((program) => (
              <tr
                key={program.id}
                className="transition-colors hover:bg-zinc-50"
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-zinc-900">
                    {program.name}
                  </div>
                  <div className="text-xs text-zinc-500">{program.slug}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {program.brandName}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">{program.year}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                      statusColors[program.status]
                    }`}
                  >
                    {program.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">
                  <div>
                    {new Date(program.applicationDeadline).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">
                  <div>
                    {new Date(program.startDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {" - "}
                    {new Date(program.endDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${program.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700"}`}>
                      {program.isPublished ? "Published" : "Hidden"}
                    </span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${program.isActive ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-700"}`}>
                      {program.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/programs/${program.id}`}
                      className="rounded-md p-2 text-zinc-600 hover:bg-blue-50 hover:text-blue-600"
                      title="View program"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => onEdit(program)}
                      className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-blue-600"
                      title="Edit program"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(program)}
                      className="rounded-md p-2 text-zinc-600 hover:bg-red-50 hover:text-red-600"
                      title="Delete program"
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
