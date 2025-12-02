"use client";

import { PlusIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { CategoriesTable, type Category } from "../components/categories/CategoriesTable";
import { CategoryFormModal, type CategoryFormData } from "../components/categories/CategoryFormModal";
import { DeleteConfirmModal } from "../components/shared/DeleteConfirmModal";

// Mock data - will be replaced with API calls
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
    // TODO: Replace with API call
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
    
    // TODO: Replace with API call
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
    
    // TODO: Replace with API call
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
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Program Categories</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Organize programs into categories for better management
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsFormModalOpen(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
          Create Category
        </button>
      </div>

      {/* Categories Table */}
      <CategoriesTable
        categories={categories}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Form Modal */}
      <CategoryFormModal
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSubmit={selectedCategory ? handleUpdateCategory : handleCreateCategory}
        category={selectedCategory}
      />

      {/* Delete Confirmation Modal */}
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
