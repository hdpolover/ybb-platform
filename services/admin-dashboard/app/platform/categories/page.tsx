"use client";

import { PlusIcon, FolderIcon, RectangleStackIcon, TagIcon, CalendarIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { CategoriesTable, type Category } from "../components/categories/CategoriesTable";
import { CategoryFormModal, type CategoryFormData } from "../components/categories/CategoryFormModal";
import { DeleteConfirmModal } from "../components/shared/DeleteConfirmModal";

// Data dummy dulu, nanti kedepannya bakal diganti manggil API beneran
const mockCategories: Category[] = [
  {
    id: "1",
    name: "Youth Leadership",
    description: "Programs focused on developing leadership skills in young people",
    slug: "youth-leadership",
    programCount: 5,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-11-20T15:30:00Z",
  },
  {
    id: "2",
    name: "Community Service",
    description: "Service-oriented programs for community engagement",
    slug: "community-service",
    programCount: 8,
    createdAt: "2024-02-10T09:00:00Z",
    updatedAt: "2024-11-18T14:20:00Z",
  },
  {
    id: "3",
    name: "Education & Skills",
    description: "Educational programs and skill development initiatives",
    slug: "education-skills",
    programCount: 12,
    createdAt: "2024-03-05T11:00:00Z",
    updatedAt: "2024-11-22T16:45:00Z",
  },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const handleCreateCategory = (data: CategoryFormData) => {
    // TODO: Nanti diganti jadi manggil API beneran
    const newCategory: Category = {
      id: String(Date.now()),
      name: data.name,
      description: data.description || null,
      slug: data.slug,
      programCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCategories([...categories, newCategory]);
    setIsFormModalOpen(false);
  };

  const handleUpdateCategory = (data: CategoryFormData) => {
    if (!selectedCategory) return;
    
    // TODO: Nanti diganti jadi manggil API beneran
    setCategories(
      categories.map((cat) =>
        cat.id === selectedCategory.id
          ? { ...cat, ...data, updatedAt: new Date().toISOString() }
          : cat
      )
    );
    setSelectedCategory(null);
    setIsFormModalOpen(false);
  };

  const handleDeleteCategory = () => {
    if (!selectedCategory) return;
    
    // TODO: Nanti diganti jadi manggil API beneran
    setCategories(categories.filter((cat) => cat.id !== selectedCategory.id));
    setSelectedCategory(null);
    setIsDeleteModalOpen(false);
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setIsFormModalOpen(true);
  };

  const handleDelete = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setSelectedCategory(null);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedCategory(null);
  };

  return (
    <div className="space-y-4">
      {/* Bagian header halaman kategori */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Program Categories</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Organize programs into categories for better management
        </p>
      </div>

      {/* Grid statistik kategori */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Total Categories</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{categories.length}</p>
              <p className="mt-1 text-[10px] text-zinc-600">Active brands</p>
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
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {categories.reduce((sum, cat) => sum + cat.programCount, 0)}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">Across all categories</p>
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
                {categories.length > 0 
                  ? Math.round(categories.reduce((sum, cat) => sum + cat.programCount, 0) / categories.length)
                  : 0}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">Per category</p>
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
              <p className="mt-1 text-2xl font-bold text-zinc-900">Today</p>
              <p className="mt-1 text-[10px] text-emerald-600">Recent changes</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2.5">
              <CalendarIcon className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tombol aksi buat bikin kategori baru */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsFormModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-600"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Create Category
        </button>
      </div>

      {/* Tabel daftar kategori */}
      <CategoriesTable
        categories={categories}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Modal form kategori (buat tambah / edit) */}
      <CategoryFormModal
        key={selectedCategory ? selectedCategory.id : "new"}
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSubmit={selectedCategory ? handleUpdateCategory : handleCreateCategory}
        category={selectedCategory}
      />

      {/* Modal konfirmasi hapus kategori */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteCategory}
        title="Delete Category"
        message="Are you sure you want to delete this category?"
        itemName={selectedCategory?.name}
        warningMessage={
          selectedCategory && selectedCategory.programCount > 0
            ? `This category has ${selectedCategory.programCount} program(s) associated with it. They will need to be reassigned.`
            : undefined
        }
      />
    </div>
  );
}
