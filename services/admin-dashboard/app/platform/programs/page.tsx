"use client";

import { PlusIcon, RectangleStackIcon, UserGroupIcon, CheckCircleIcon, ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { useState, useMemo } from "react";
import { ProgramsTable, type Program } from "../components/programs/ProgramsTable";
import { ProgramFormModal, type ProgramFormData } from "../components/programs/ProgramFormModal";
import { ProgramFilters } from "../components/programs/ProgramFilters";
import { DeleteConfirmModal } from "../components/shared/DeleteConfirmModal";

// Mock categories data
const mockCategories = [
  { id: "1", name: "Youth Leadership" },
  { id: "2", name: "Community Service" },
  { id: "3", name: "Education & Skills" },
];

// Mock programs data
const mockPrograms: Program[] = [
  {
    id: "1",
    name: "Summer Leadership Camp 2025",
    description: "Intensive leadership training for high school students",
    categoryId: "1",
    categoryName: "Youth Leadership",
    slug: "summer-leadership-camp-2025",
    status: "published",
    registrationStartDate: "2025-01-15T00:00:00Z",
    registrationEndDate: "2025-05-31T00:00:00Z",
    programStartDate: "2025-06-15T00:00:00Z",
    programEndDate: "2025-06-30T00:00:00Z",
    registrationFee: 350,
    participantCount: 42,
    maxParticipants: 50,
    createdAt: "2024-11-01T10:00:00Z",
    updatedAt: "2024-11-28T14:30:00Z",
  },
  {
    id: "2",
    name: "Community Builders Workshop",
    description: "Hands-on workshop for community engagement projects",
    categoryId: "2",
    categoryName: "Community Service",
    slug: "community-builders-workshop",
    status: "published",
    registrationStartDate: "2025-02-01T00:00:00Z",
    registrationEndDate: "2025-03-15T00:00:00Z",
    programStartDate: "2025-03-20T00:00:00Z",
    programEndDate: "2025-03-22T00:00:00Z",
    registrationFee: 150,
    participantCount: 28,
    maxParticipants: 30,
    createdAt: "2024-10-15T09:00:00Z",
    updatedAt: "2024-11-25T16:20:00Z",
  },
  {
    id: "3",
    name: "Digital Skills Bootcamp",
    description: "Learn coding, design, and digital marketing fundamentals",
    categoryId: "3",
    categoryName: "Education & Skills",
    slug: "digital-skills-bootcamp",
    status: "draft",
    registrationStartDate: "2025-03-01T00:00:00Z",
    registrationEndDate: "2025-04-30T00:00:00Z",
    programStartDate: "2025-05-05T00:00:00Z",
    programEndDate: "2025-05-25T00:00:00Z",
    registrationFee: 500,
    participantCount: 0,
    maxParticipants: 25,
    createdAt: "2024-11-20T11:00:00Z",
    updatedAt: "2024-11-30T10:15:00Z",
  },
  {
    id: "4",
    name: "Youth Mentorship Program 2024",
    description: "Connect youth with experienced mentors in various fields",
    categoryId: "1",
    categoryName: "Youth Leadership",
    slug: "youth-mentorship-program-2024",
    status: "archived",
    registrationStartDate: "2024-06-01T00:00:00Z",
    registrationEndDate: "2024-08-31T00:00:00Z",
    programStartDate: "2024-09-01T00:00:00Z",
    programEndDate: "2024-12-15T00:00:00Z",
    registrationFee: 0,
    participantCount: 65,
    maxParticipants: null,
    createdAt: "2024-05-10T08:00:00Z",
    updatedAt: "2024-12-01T09:30:00Z",
  },
];

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>(mockPrograms);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Filtered programs
  const filteredPrograms = useMemo(() => {
    return programs.filter((program) => {
      const matchesSearch =
        searchQuery === "" ||
        program.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        program.slug.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "" || program.categoryId === selectedCategory;

      const matchesStatus =
        selectedStatus === "" || program.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [programs, searchQuery, selectedCategory, selectedStatus]);

  const handleCreateProgram = (data: ProgramFormData) => {
    const category = mockCategories.find((c) => c.id === data.categoryId);
    const newProgram: Program = {
      id: String(Date.now()),
      name: data.name,
      description: data.description || null,
      categoryId: data.categoryId,
      categoryName: category?.name || "Unknown",
      slug: data.slug,
      status: data.status,
      registrationStartDate: data.registrationStartDate || null,
      registrationEndDate: data.registrationEndDate || null,
      programStartDate: data.programStartDate || null,
      programEndDate: data.programEndDate || null,
      registrationFee: data.registrationFee,
      participantCount: 0,
      maxParticipants: data.maxParticipants,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPrograms([...programs, newProgram]);
    setIsFormModalOpen(false);
  };

  const handleUpdateProgram = (data: ProgramFormData) => {
    if (!selectedProgram) return;

    const category = mockCategories.find((c) => c.id === data.categoryId);
    setPrograms(
      programs.map((prog) =>
        prog.id === selectedProgram.id
          ? {
              ...prog,
              ...data,
              categoryName: category?.name || prog.categoryName,
              updatedAt: new Date().toISOString(),
            }
          : prog
      )
    );
    setSelectedProgram(null);
    setIsFormModalOpen(false);
  };

  const handleDeleteProgram = () => {
    if (!selectedProgram) return;

    setPrograms(programs.filter((prog) => prog.id !== selectedProgram.id));
    setSelectedProgram(null);
    setIsDeleteModalOpen(false);
  };

  const handleEdit = (program: Program) => {
    setSelectedProgram(program);
    setIsFormModalOpen(true);
  };

  const handleDelete = (program: Program) => {
    setSelectedProgram(program);
    setIsDeleteModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setSelectedProgram(null);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedProgram(null);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Programs</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage all programs across categories
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Total Programs</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{programs.length}</p>
              <p className="mt-1 text-[10px] text-zinc-600">All categories</p>
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
                {programs.filter(p => p.status === 'published').length}
              </p>
              <p className="mt-1 text-[10px] text-emerald-600">Active programs</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2.5">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Total Participants</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {programs.reduce((sum, p) => sum + p.participantCount, 0)}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">Registered users</p>
            </div>
            <div className="rounded-full bg-purple-100 p-2.5">
              <UserGroupIcon className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Archived</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {programs.filter(p => p.status === 'archived').length}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">Past programs</p>
            </div>
            <div className="rounded-full bg-zinc-100 p-2.5">
              <ArchiveBoxIcon className="h-5 w-5 text-zinc-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
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

      {/* Filters */}
      <ProgramFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        categories={mockCategories}
      />

      {/* Programs Table */}
      <ProgramsTable
        programs={filteredPrograms}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Form Modal */}
      <ProgramFormModal
        key={selectedProgram ? selectedProgram.id : "new"}
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSubmit={selectedProgram ? handleUpdateProgram : handleCreateProgram}
        program={selectedProgram}
        categories={mockCategories}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteProgram}
        title="Delete Program"
        message="Are you sure you want to delete this program? This action cannot be undone."
        itemName={selectedProgram?.name}
        warningMessage={
          selectedProgram && selectedProgram.participantCount > 0
            ? `This program has ${selectedProgram.participantCount} registered participant(s). All their data will be preserved but the program will be deleted.`
            : undefined
        }
      />
    </div>
  );
}
