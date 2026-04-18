"use client";

import { useMemo, useEffect, useState } from "react";
import { Layers, FolderOpen, BarChart2, Clock } from "lucide-react";
import { CategoriesTable, type Category } from "../components/categories/CategoriesTable";
import { CategoryFormModal, type CategoryFormData } from "../components/categories/CategoryFormModal";
import { PageHeader } from "@/src/admin/page-header";
import { StatCard } from "@/src/admin/stat-card";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { Button } from "@/src/ui/button";
import {
  createPlatformBrand,
  deletePlatformBrand,
  listPlatformBrands,
  type PlatformBrand,
  updatePlatformBrand,
} from "../api";

function mapBrandToCategory(brand: PlatformBrand): Category {
  return {
    id: brand.id,
    name: brand.name,
    description: brand.description ?? null,
    slug: brand.slug,
    programCount: brand.programCount,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}

export default function BrandsManagementPage() {
  const [brands, setBrands] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Category | null>(null);

  const totalPrograms = useMemo(
    () => brands.reduce((sum, brand) => sum + brand.programCount, 0),
    [brands],
  );

  const lastUpdatedLabel = useMemo(() => {
    if (brands.length === 0) {
      return "—";
    }

    const latestTimestamp = brands.reduce((latest, brand) => {
      const timestamp = new Date(brand.updatedAt).getTime();
      return timestamp > latest ? timestamp : latest;
    }, 0);

    return new Date(latestTimestamp).toLocaleDateString();
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

        setBrands(data.map(mapBrandToCategory));
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
        [...current, mapBrandToCategory(createdBrand)].sort((left, right) => left.name.localeCompare(right.name)),
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

      const mappedBrand = mapBrandToCategory(updatedBrand);
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

  const handleDeleteBrand = async () => {
    if (!selectedBrand) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deletePlatformBrand(selectedBrand.id);
      setBrands((current) => current.filter((brand) => brand.id !== selectedBrand.id));
      setSelectedBrand(null);
      setIsDeleteModalOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete brand.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (brand: Category) => {
    setFormError(null);
    setSelectedBrand(brand);
    setIsFormModalOpen(true);
  };

  const handleDelete = (brand: Category) => {
    setDeleteError(null);
    setSelectedBrand(brand);
    setIsDeleteModalOpen(true);
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
    setSelectedBrand(null);
    setDeleteError(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands"
        description="Manage brands that group and anchor your programs"
        actions={
          <Button onClick={() => setIsFormModalOpen(true)}>
            Create Brand
          </Button>
        }
      />

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

      {pageError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          Loading brands…
        </div>
      ) : (
        <CategoriesTable categories={brands} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <CategoryFormModal
        key={selectedBrand ? selectedBrand.id : "new"}
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
        description={
          selectedBrand?.programCount
            ? `"${selectedBrand.name}" has ${selectedBrand.programCount} program(s). Are you sure you want to delete it?`
            : `Are you sure you want to delete "${selectedBrand?.name ?? "this brand"}"? This action cannot be undone.`
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteBrand}
        loading={isDeleting}
      />
    </div>
  );
}