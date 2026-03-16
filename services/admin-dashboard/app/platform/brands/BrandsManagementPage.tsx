"use client";

import {
  PlusIcon,
  FolderIcon,
  RectangleStackIcon,
  TagIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { CategoriesTable, type Category } from "../components/categories/CategoriesTable";
import { CategoryFormModal, type CategoryFormData } from "../components/categories/CategoryFormModal";
import { DeleteConfirmModal } from "../components/shared/DeleteConfirmModal";
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Brands</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage brands that group and anchor your programs
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Total Brands</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{brands.length}</p>
              <p className="mt-1 text-[10px] text-zinc-600">Available brands</p>
            </div>
            <div className="rounded-full bg-blue-100 p-2.5">
              <FolderIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Total Programs</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{totalPrograms}</p>
              <p className="mt-1 text-[10px] text-zinc-600">Across all brands</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2.5">
              <RectangleStackIcon className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Avg Programs</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {brands.length > 0 ? Math.round(totalPrograms / brands.length) : 0}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">Per brand</p>
            </div>
            <div className="rounded-full bg-purple-100 p-2.5">
              <TagIcon className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Last Updated</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{lastUpdatedLabel}</p>
              <p className="mt-1 text-[10px] text-emerald-600">Recent changes</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2.5">
              <CalendarIcon className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsFormModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-600"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Create Brand
        </button>
      </div>

      {pageError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-600">
          Loading brands...
        </div>
      ) : (
        <CategoriesTable
          categories={brands}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
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

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteBrand}
        title="Delete Brand"
        message="Are you sure you want to delete this brand?"
        itemName={selectedBrand?.name}
        isSubmitting={isDeleting}
        errorMessage={deleteError}
        warningMessage={
          selectedBrand && selectedBrand.programCount > 0
            ? `This brand has ${selectedBrand.programCount} program(s) associated with it. They will need to be reassigned.`
            : undefined
        }
      />
    </div>
  );
}