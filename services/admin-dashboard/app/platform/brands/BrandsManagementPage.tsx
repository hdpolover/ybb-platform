"use client";

import { useMemo, useEffect, useState } from "react";
import { Layers, FolderOpen, BarChart2, Clock } from "lucide-react";
import { BrandsTable, type Brand } from "../components/brands/BrandsTable";
import { CategoryFormModal, type CategoryFormData } from "../components/categories/CategoryFormModal";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { PageHeader } from "@/src/admin/page-header";
import { StatCard } from "@/src/admin/stat-card";
import { FilterBar } from "@/src/admin/filter-bar";
import { Button } from "@/src/ui/button";
import { Select } from "@/src/ui/select";
import { Skeleton } from "@/src/ui/skeleton";
import { formatDate, parseApiDate } from "@/lib/utils";
import {
  createPlatformBrand,
  deletePlatformBrand,
  listPlatformBrands,
  type PlatformBrand,
  updatePlatformBrand,
} from "../api";

function mapBrand(brand: PlatformBrand): Brand {
  return {
    id: brand.id,
    name: brand.name,
    description: brand.description ?? null,
    slug: brand.slug,
    isActive: brand.isActive,
    programCount: brand.programCount,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}

export default function BrandsManagementPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const formModalKey = selectedBrand ? selectedBrand.id : `new-${isFormModalOpen ? "open" : "closed"}`;

  const filteredBrands = useMemo(() => {
    let result = brands;
    if (statusFilter !== "all") {
      result = result.filter((b) => (statusFilter === "active" ? b.isActive : !b.isActive));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q),
      );
    }
    return result;
  }, [brands, search, statusFilter]);

  const totalPrograms = useMemo(
    () => brands.reduce((sum, brand) => sum + brand.programCount, 0),
    [brands],
  );

  const lastUpdatedLabel = useMemo(() => {
    if (brands.length === 0) {
      return "—";
    }

    const timestamps = brands
      .map((brand) => parseApiDate(brand.updatedAt || brand.createdAt).getTime())
      .filter((timestamp) => Number.isFinite(timestamp));

    if (timestamps.length === 0) {
      return "—";
    }

    return formatDate(new Date(Math.max(...timestamps)));
  }, [brands]);

  useEffect(() => {
    let isMounted = true;

    async function loadBrands() {
      setIsLoading(true);
      setPageError(null);

      try {
        const data = await listPlatformBrands();
        if (!isMounted) {
          return;
        }

        setBrands(data.map(mapBrand));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(error instanceof Error ? error.message : "Failed to load brands.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBrands();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateBrand = async (data: CategoryFormData) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const createdBrand = await createPlatformBrand({
        name: data.name,
        slug: data.slug,
        description: data.description,
      });

      setBrands((current) =>
        [...current, mapBrand(createdBrand)].sort((left, right) => left.name.localeCompare(right.name)),
      );
      setIsFormModalOpen(false);
      setSelectedBrand(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create brand.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBrand = async (data: CategoryFormData) => {
    if (!selectedBrand) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const updatedBrand = await updatePlatformBrand(selectedBrand.id, {
        name: data.name,
        slug: data.slug,
        description: data.description,
      });

      const mappedBrand = mapBrand(updatedBrand);
      setBrands((current) =>
        current
          .map((brand) => (brand.id === mappedBrand.id ? mappedBrand : brand))
          .sort((left, right) => left.name.localeCompare(right.name)),
      );
      setIsFormModalOpen(false);
      setSelectedBrand(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to update brand.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (brand: Brand) => {
    setFormError(null);
    setSelectedBrand(brand);
    setIsFormModalOpen(true);
  };

  const handleDelete = (brand: Brand) => {
    setDeleteError(null);
    setBrandToDelete(brand);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteBrand = async () => {
    if (!brandToDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deletePlatformBrand(brandToDelete.id);
      setBrands((current) => current.filter((brand) => brand.id !== brandToDelete.id));
      setBrandToDelete(null);
      setIsDeleteModalOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete brand.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseFormModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsFormModalOpen(false);
    setSelectedBrand(null);
    setFormError(null);
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) {
      return;
    }

    setIsDeleteModalOpen(false);
    setBrandToDelete(null);
    setDeleteError(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands"
        description="Manage brands that group and anchor your programs"
        actions={
          <Button
            onClick={() => {
              setFormError(null);
              setSelectedBrand(null);
              setIsFormModalOpen(true);
            }}
          >
            Create Brand
          </Button>
        }
      />

      {isLoading ? (
        <BrandsManagementSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Total Brands" value={brands.length} description="Available brands" icon={FolderOpen} />
          <StatCard title="Total Programs" value={totalPrograms} description="Across all brands" icon={Layers} />
          <StatCard
            title="Avg Programs"
            value={brands.length > 0 ? Math.round(totalPrograms / brands.length) : 0}
            description="Per brand"
            icon={BarChart2}
          />
          <StatCard title="Last Updated" value={lastUpdatedLabel} description="Recent changes" icon={Clock} />
        </div>
      )}

      {pageError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search brands…"
        resultCount={filteredBrands.length}
        filters={
          <Select
            className="h-8 w-[130px] text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        }
      />

      {isLoading ? null : (
        <BrandsTable brands={filteredBrands} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <CategoryFormModal
        key={formModalKey}
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSubmit={selectedBrand ? handleUpdateBrand : handleCreateBrand}
        category={selectedBrand}
        isSubmitting={isSubmitting}
        errorMessage={formError}
      />

      <ConfirmDialog
        open={isDeleteModalOpen}
        onOpenChange={(open) => !open && handleCloseDeleteModal()}
        title="Delete Brand"
        description={`Are you sure you want to delete "${brandToDelete?.name ?? "this brand"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteBrand}
        loading={isDeleting}
      />
    </div>
  );
}

function BrandsManagementSkeleton() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 min-w-0 flex-1 sm:max-w-xs" />
        <Skeleton className="h-10 w-[130px]" />
        <div className="ml-auto">
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </>
  );
}
