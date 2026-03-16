"use client";

import { MagnifyingGlassIcon, FunnelIcon } from "@heroicons/react/24/outline";

type ProgramFiltersProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedBrand: string;
  onBrandChange: (brandId: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  categories: Array<{ id: string; name: string }>;
};

export function ProgramFilters({
  searchQuery,
  onSearchChange,
  selectedBrand,
  onBrandChange,
  selectedStatus,
  onStatusChange,
  categories,
}: ProgramFiltersProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Kolom search program */}
        <div className="flex-1 min-w-[240px]">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search programs..."
              className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filter kategori program */}
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-4 w-4 text-zinc-500" />
          <select
            value={selectedBrand}
            onChange={(e) => onBrandChange(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Brands</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filter status program */}
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Tombol buat clear semua filter */}
        {(searchQuery || selectedBrand || selectedStatus) && (
          <button
            type="button"
            onClick={() => {
              onSearchChange("");
              onBrandChange("");
              onStatusChange("");
            }}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
