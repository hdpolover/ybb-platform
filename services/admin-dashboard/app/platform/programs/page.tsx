"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, CheckCircle, Users, Archive } from "lucide-react";
import { toast } from "sonner";
import { ProgramsTable, type Program } from "../components/programs/ProgramsTable";
import { ProgramFormModal, type ProgramFormData } from "../components/programs/ProgramFormModal";
import { PageHeader } from "@/src/admin/page-header";
import { StatCard } from "@/src/admin/stat-card";
import { FilterBar } from "@/src/admin/filter-bar";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { Button } from "@/src/ui/button";
import {
  applyTemplateToProgram,
  fetchFormTemplates,
} from "@/app/components/submissionsMasterData/form-fields/catalog-api";
import { FLAGS } from "@/app/flags";
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

  async function offerDefaultTemplate(programId: string) {
    try {
      const templates = await fetchFormTemplates();
      // Prefer a default template; any will do for MVP
      const defaultTemplate = templates.find((t) => t.isDefault);
      if (!defaultTemplate) return;

      const ok = window.confirm(
        `Apply the "${defaultTemplate.name}" template?\n\n` +
          `It will pre-populate ${defaultTemplate.fieldCount} form fields. ` +
          `You can edit or remove any of them later.`,
      );
      if (!ok) return;

      const result = await applyTemplateToProgram(programId, defaultTemplate.id, "append");
      toast.success(
        `Added ${result.added.length} fields from "${defaultTemplate.name}".`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to apply default template",
      );
    }
  }

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
      if (FLAGS.FORM_FIELD_CATALOG_V2) {
        await offerDefaultTemplate(createdProgram.id);
      }
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
    <div className="space-y-6">
      <PageHeader
        title="Programs"
        description="Manage program shells across brands. Fees, capacity, and registration windows are handled inside each program workspace."
        actions={
          <Button onClick={() => setIsFormModalOpen(true)}>
            Create Program
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Programs" value={programs.length} description="All brands" icon={Layers} />
        <StatCard
          title="Published"
          value={programs.filter((p) => p.status === "published").length}
          description="Launch-ready programs"
          icon={CheckCircle}
        />
        <StatCard
          title="Active"
          value={programs.filter((p) => p.isActive).length}
          description="Currently enabled"
          icon={Users}
        />
        <StatCard
          title="Closed"
          value={programs.filter((p) => p.status === "completed" || p.status === "cancelled").length}
          description="Completed or cancelled"
          icon={Archive}
        />
      </div>

      <FilterBar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search programs…"
        resultCount={filteredPrograms.length}
        filters={
          <>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="flex h-9 rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <option value="">All Brands</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex h-9 rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </>
        }
      />

      {pageError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          Loading programs…
        </div>
      ) : (
        <ProgramsTable programs={filteredPrograms} onEdit={handleEdit} onDelete={handleDelete} />
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

      <ConfirmDialog
        open={isDeleteModalOpen}
        onOpenChange={(open) => !open && handleCloseDeleteModal()}
        title="Delete Program"
        description={`Are you sure you want to delete "${selectedProgram?.name ?? "this program"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteProgram}
        loading={isDeleting}
      />
    </div>
  );
}
