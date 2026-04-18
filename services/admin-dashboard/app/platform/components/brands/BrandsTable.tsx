"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";
import { Button } from "@/src/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/ui/dropdown-menu";
import { Badge } from "@/src/ui/badge";
import { StatusBadge } from "@/src/admin/status-badge";
import { EmptyState } from "@/src/admin/empty-state";

export type Brand = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  isActive: boolean;
  programCount: number;
  createdAt: string;
  updatedAt: string;
};

type SortKey = "name" | "programCount" | "updatedAt";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

type BrandsTableProps = {
  brands: Brand[];
  onEdit: (brand: Brand) => void;
};

export function BrandsTable({ brands, onEdit }: BrandsTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  // Reset to page 1 when the data set changes (e.g. search filter)
  useEffect(() => {
    setPage(1);
  }, [brands]);

  const sorted = useMemo(() => {
    return [...brands].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "programCount":
          return (a.programCount - b.programCount) * dir;
        case "updatedAt":
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir;
        default:
          return 0;
      }
    });
  }, [brands, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (brands.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No brands found"
        description="Try adjusting your search or create a new brand."
      />
    );
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ArrowUpDown className="ml-1 h-3 w-3 text-zinc-400" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                type="button"
                className="inline-flex items-center text-xs font-medium hover:text-zinc-900"
                onClick={() => toggleSort("name")}
              >
                Brand
                <SortIcon column="name" />
              </button>
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <button
                type="button"
                className="inline-flex items-center text-xs font-medium hover:text-zinc-900"
                onClick={() => toggleSort("programCount")}
              >
                Programs
                <SortIcon column="programCount" />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                className="inline-flex items-center text-xs font-medium hover:text-zinc-900"
                onClick={() => toggleSort("updatedAt")}
              >
                Updated
                <SortIcon column="updatedAt" />
              </button>
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.map((brand) => (
            <TableRow
              key={brand.id}
              className="cursor-pointer hover:bg-zinc-50"
              onClick={() => router.push(`/platform/brands/${brand.id}`)}
            >
              <TableCell>
                <div>
                  <p className="font-semibold text-zinc-900">{brand.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-zinc-400">{brand.slug}</p>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={brand.isActive ? "active" : "inactive"} context="generic" />
              </TableCell>
              <TableCell>
                <Badge variant="info">{brand.programCount}</Badge>
              </TableCell>
              <TableCell className="text-sm text-zinc-500">
                {new Date(brand.updatedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(brand);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination footer — always visible for data table feel */}
      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
        <p className="text-xs text-zinc-500">
          {sorted.length === 0
            ? "No results"
            : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, sorted.length)} of ${sorted.length}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-zinc-600">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
