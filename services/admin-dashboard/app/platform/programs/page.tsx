"use client";

import {
  PlusIcon,
  RectangleStackIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { ProgramsTable, type Program } from "../components/programs/ProgramsTable";
import { ProgramFormModal, type ProgramFormData } from "../components/programs/ProgramFormModal";
import { ProgramFilters } from "../components/programs/ProgramFilters";
import { DeleteConfirmModal } from "../components/shared/DeleteConfirmModal";
import {
  createPlatformProgram,
  deletePlatformProgram,
  listPlatformBrands,
  listPlatformPrograms,
  type PlatformBrand,
  type PlatformProgram,
  updatePlatformProgram,
} from "../api";

const brandOptions = (brands: PlatformBrand[]) =>
  brands.map((brand) => ({ id: brand.id, name: brand.name }));

function mapProgram(program: PlatformProgram): Program {
  return {
    id: program.id,
    brandId: program.brandId,
    brandName: program.brandName ?? "Unknown Brand",
    name: program.name,
    description: program.description,
    slug: program.slug,
    year: program.year,
    status: program.status as Program["status"],
    applicationDeadline: program.applicationDeadline,
    startDate: program.startDate,
    endDate: program.endDate,
    isPublished: program.isPublished,
    isActive: program.isActive,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
  };
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setPageError(null);

      try {
        const [brands, programList] = await Promise.all([
          listPlatformBrands(),
          listPlatformPrograms({ page: 1, limit: 100 }),
        ]);

        if (!isMounted) {
          return;
        }

        setCategories(brandOptions(brands));
        setPrograms(programList.data.map(mapProgram));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(error instanceof Error ? error.message : "Failed to load programs.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPrograms = useMemo(() => {
    return programs.filter((program) => {
      const matchesSearch =
        searchQuery === "" ||
        program.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        program.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        program.brandName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBrand = selectedBrand === "" || program.brandId === selectedBrand;
      const matchesStatus = selectedStatus === "" || program.status === selectedStatus;

      return matchesSearch && matchesBrand && matchesStatus;
    });
  }, [programs, searchQuery, selectedBrand, selectedStatus]);

  const handleCreateProgram = async (data: ProgramFormData) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const createdProgram = await createPlatformProgram({
        brandId: data.brandId,
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        year: data.year,
        startDate: data.startDate,
        endDate: data.endDate,
        applicationDeadline: data.applicationDeadline,
        status: data.status,
        isPublished: data.isPublished,
        isActive: data.isActive,
      });

      setPrograms((current) => [mapProgram(createdProgram), ...current]);
      setIsFormModalOpen(false);
      setSelectedProgram(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create program.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProgram = async (data: ProgramFormData) => {
    if (!selectedProgram) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const updatedProgram = await updatePlatformProgram(selectedProgram.id, {
        brandId: data.brandId,
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        year: data.year,
        startDate: data.startDate,
        endDate: data.endDate,
        applicationDeadline: data.applicationDeadline,
        status: data.status,
        isPublished: data.isPublished,
        isActive: data.isActive,
      });

      const mappedProgram = mapProgram(updatedProgram);
      setPrograms((current) =>
        current.map((program) => (program.id === mappedProgram.id ? mappedProgram : program)),
      );
      setIsFormModalOpen(false);
      setSelectedProgram(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to update program.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProgram = async () => {
    if (!selectedProgram) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deletePlatformProgram(selectedProgram.id);
      setPrograms((current) => current.filter((program) => program.id !== selectedProgram.id));
      setSelectedProgram(null);
      setIsDeleteModalOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete program.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (program: Program) => {
    setFormError(null);
    setSelectedProgram(program);
    setIsFormModalOpen(true);
  };

  const handleDelete = (program: Program) => {
    setDeleteError(null);
    setSelectedProgram(program);
    setIsDeleteModalOpen(true);
  };

  const handleCloseFormModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsFormModalOpen(false);
    setSelectedProgram(null);
    setFormError(null);
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) {
      return;
    }

    setIsDeleteModalOpen(false);
    setSelectedProgram(null);
    setDeleteError(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Programs</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage top-level program shells across brands. Fees, capacity, location, and registration windows are handled inside each program admin workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Total Programs</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{programs.length}</p>
              <p className="mt-1 text-[10px] text-zinc-600">All brands</p>
            </div>
            <div className="rounded-full bg-blue-100 p-2.5">
              <RectangleStackIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Published</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {programs.filter((program) => program.status === "published").length}
              </p>
              <p className="mt-1 text-[10px] text-emerald-600">Launch-ready programs</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2.5">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Active</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {programs.filter((program) => program.isActive).length}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">Currently enabled programs</p>
            </div>
            <div className="rounded-full bg-purple-100 p-2.5">
              <UserGroupIcon className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Closed</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {programs.filter((program) => program.status === "completed" || program.status === "cancelled").length}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">Completed or cancelled</p>
            </div>
            <div className="rounded-full bg-zinc-100 p-2.5">
              <ArchiveBoxIcon className="h-5 w-5 text-zinc-600" />
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
          Create Program
        </button>
      </div>

      <ProgramFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedBrand={selectedBrand}
        onBrandChange={setSelectedBrand}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        categories={categories}
      />

      {pageError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-600">
          Loading programs...
        </div>
      ) : (
        <ProgramsTable
          programs={filteredPrograms}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <ProgramFormModal
        key={selectedProgram ? selectedProgram.id : "new"}
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSubmit={selectedProgram ? handleUpdateProgram : handleCreateProgram}
        program={selectedProgram}
        categories={categories}
        isSubmitting={isSubmitting}
        errorMessage={formError}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteProgram}
        title="Delete Program"
        message="Are you sure you want to delete this program? This action cannot be undone."
        itemName={selectedProgram?.name}
        isSubmitting={isDeleting}
        errorMessage={deleteError}
        warningMessage="Deleting a program removes it from active platform management. Make sure no downstream content still depends on it."
      />
    </div>
  );
}
