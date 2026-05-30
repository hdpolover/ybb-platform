"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  PhotoIcon,
  XMarkIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { MagnifyingGlassIcon, StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/src/ui/sheet";
import {
  listProgramTestimonials,
  createProgramTestimonial,
  updateProgramTestimonial,
  deleteProgramTestimonial,
  uploadFileViaPresignedUrl,
  type ProgramTestimonial,
} from "@/src/shared/api-client";

export default function ProgramTestimoniesPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms, adminProfile } = useAuth();
  const [items, setItems] = useState<ProgramTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState<"all" | "featured" | "regular">("all");
  const [sortBy, setSortBy] = useState<"order-asc" | "order-desc" | "name-asc" | "name-desc">("order-asc");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramTestimonial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramTestimonial | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const program = accessiblePrograms.find((p) => p.programId === params.programId);
  const programName = program?.programName ?? "Selected Program";
  const brandId = program?.brandId ?? "";
  const userId = adminProfile?.userId ?? "";

  const load = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true);
    setError(null);
    try {
      const all = await listProgramTestimonials(params.programId);
      setItems(all.filter((t) => t.type !== "video"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [params.programId]);

  useEffect(() => { load(); }, [load]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(items.map((item) => (item.category ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        const matchesSearch = !normalizedSearch || [item.name, item.role ?? "", item.company ?? "", item.testimonial].join(" ").toLowerCase().includes(normalizedSearch);
        const matchesCategory = categoryFilter === "all" || (item.category ?? "").trim() === categoryFilter;
        const matchesFeatured = featuredFilter === "all" || (featuredFilter === "featured" ? Boolean(item.isFeatured) : !item.isFeatured);
        return matchesSearch && matchesCategory && matchesFeatured;
      })
      .sort((left, right) => compareTestimonials(left, right, sortBy));
  }, [items, searchTerm, categoryFilter, featuredFilter, sortBy]);

  function resetFilters() {
    setSearchTerm("");
    setCategoryFilter("all");
    setFeaturedFilter("all");
    setSortBy("order-asc");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteProgramTestimonial(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Master Data
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Testimonials</h1>
        <p className="text-sm text-zinc-500">Manage testimonials for this program.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">Showing {filteredItems.length} of {items.length} testimonial(s)</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add Testimonial
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <div className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name, role, company, or testimonial..." className="block w-full rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="all">All categories</option>
                {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Featured</label>
              <select value={featuredFilter} onChange={(e) => setFeaturedFilter(e.target.value as typeof featuredFilter)} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="all">All testimonials</option>
                <option value="featured">Featured only</option>
                <option value="regular">Regular only</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="order-asc">Order: low to high</option>
                <option value="order-desc">Order: high to low</option>
                <option value="name-asc">Name: A-Z</option>
                <option value="name-desc">Name: Z-A</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={resetFilters} className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50">Reset filters</button>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Role / Company</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Testimonial</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">Loading…</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">No testimonials yet.</td>
                </tr>
              )}
              {!loading && items.length > 0 && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">No testimonials match the current filters.</td>
                </tr>
              )}
              {!loading && filteredItems.map((t, idx) => (
                <tr key={t.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200">
                        {t.avatarUrl ? (
                          <img src={t.avatarUrl} alt={t.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-400">
                            <UserCircleIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-zinc-900">{t.name}</div>
                        {t.isFeatured && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600">
                            <StarSolidIcon className="h-2.5 w-2.5" />Featured
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">
                    {[t.role, t.company].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      t.category === "alumni" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {t.category ?? "delegate"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="line-clamp-2 max-w-xs text-zinc-600">{t.testimonial}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditTarget(t)}
                        className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(t)}
                        className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create Sheet */}
      <TestimonialSheet
        programId={params.programId}
        userId={userId}
        brandId={brandId}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={load}
      />

      {/* Edit Sheet */}
      <TestimonialSheet
        programId={params.programId}
        userId={userId}
        brandId={brandId}
        item={editTarget ?? undefined}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={load}
      />

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.name}
          loading={deleteLoading}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </main>
  );
}

function compareTestimonials(
  left: ProgramTestimonial,
  right: ProgramTestimonial,
  sortBy: "order-asc" | "order-desc" | "name-asc" | "name-desc",
): number {
  if (sortBy === "name-asc") return left.name.localeCompare(right.name);
  if (sortBy === "name-desc") return right.name.localeCompare(left.name);
  if (sortBy === "order-desc") return right.order - left.order || left.name.localeCompare(right.name);
  return left.order - right.order || left.name.localeCompare(right.name);
}

// ─── Testimonial Sheet (Add / Edit) ──────────────────────────────────────────

function TestimonialSheet({
  programId,
  userId,
  brandId,
  item,
  open,
  onClose,
  onSaved,
}: {
  programId: string;
  userId: string;
  brandId: string;
  item?: ProgramTestimonial;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(item?.name ?? "");
  const [role, setRole] = useState(item?.role ?? "");
  const [company, setCompany] = useState(item?.company ?? "");
  const [testimonial, setTestimonial] = useState(item?.testimonial ?? "");
  const [category, setCategory] = useState<"delegate" | "alumni">("delegate");
  const [alumniYear, setAlumniYear] = useState<number | "">(item?.alumniYear ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(item?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when sheet opens with (potentially new) item
  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setRole(item?.role ?? "");
      setCompany(item?.company ?? "");
      setTestimonial(item?.testimonial ?? "");
      setCategory("delegate");
      setAlumniYear(item?.alumniYear ?? "");
      setSelectedFile(null);
      setPreviewUrl(item?.avatarUrl ?? null);
      setError(null);
    }
  }, [open, item]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemovePhoto() {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let avatarUrl: string | undefined;
      if (selectedFile) {
        if (!userId || !brandId) {
          throw new Error("Cannot upload photo: missing user or brand context.");
        }
        const upload = await uploadFileViaPresignedUrl(selectedFile, {
          userId,
          brandId,
          bucket: "avatars",
          assetType: "avatar",
        });
        if (!upload.publicUrl) throw new Error("Upload succeeded but no public URL returned.");
        avatarUrl = upload.publicUrl;
      }
      const resolvedAlumniYear = alumniYear === "" ? null : alumniYear;
      if (isEdit && item) {
        await updateProgramTestimonial(item.id, { name, role, company, testimonial, brandId, category, alumniYear: resolvedAlumniYear, ...(avatarUrl ? { avatarUrl } : {}) });
      } else {
        await createProgramTestimonial(programId, { name, role, company, testimonial, brandId, category, alumniYear: resolvedAlumniYear, ...(avatarUrl ? { avatarUrl } : {}) });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-lg">
        {/* Header */}
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>{isEdit ? "Edit Testimonial" : "Add Testimonial"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update the person details and testimonial content."
              : "Add a new testimonial from a delegate or alumnus."}
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <form
          id="testimonial-sheet-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-5 overflow-y-auto px-6 py-6"
        >
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          {/* Photo upload */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Photo
            </p>
            {previewUrl ? (
              <div className="relative inline-block">
                <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-50 shadow-sm">
                  <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow transition hover:bg-rose-600"
                  aria-label="Remove photo"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50 text-center transition hover:border-blue-400 hover:bg-blue-50/30"
              >
                <div className="rounded-full bg-blue-50 p-1.5 text-blue-500">
                  <PhotoIcon className="h-4 w-4" />
                </div>
                <p className="text-[10px] leading-tight text-zinc-500 px-1">Upload</p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {selectedFile && (
              <p className="mt-1.5 max-w-[180px] truncate text-[11px] text-zinc-500">
                {selectedFile.name}
              </p>
            )}
          </div>

          {/* Name & Country */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Aisyah Putri"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">Company / Country</label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={inputCls}
              >
                <option value="">— select country —</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">Role / Program</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Delegate – Japan Youth Summit 2025"
              className={inputCls}
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as "delegate" | "alumni")}
              className={inputCls}
            >
              <option value="delegate">Delegate — shown in Testimonials section</option>
              <option value="alumni">Alumni — shown in Alumni Stories section</option>
            </select>
          </div>

          {/* Batch / Alumni Year */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">
              Batch / Alumni Year <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              type="number"
              min={1900}
              max={2100}
              value={alumniYear}
              onChange={(e) =>
                setAlumniYear(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="e.g., 2024"
              className={inputCls}
            />
          </div>

          {/* Testimonial */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">
              Testimonial <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={7}
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
              placeholder="Write the testimonial content…"
              className={inputCls}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="testimonial-sheet-form"
            disabled={saving}
            className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Testimonial"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

function ConfirmDelete({
  name,
  loading,
  onCancel,
  onConfirm,
}: {
  name: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete?</h2>
        <p className="text-[11px] text-zinc-600">
          Remove <span className="font-semibold">{name}</span>? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia",
  "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Belarus", "Belgium", "Belize",
  "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei",
  "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Chad", "Chile",
  "China", "Colombia", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Estonia",
  "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana",
  "Greece", "Guatemala", "Guinea", "Haiti", "Honduras", "Hungary", "Iceland", "India",
  "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
  "Liberia", "Libya", "Lithuania", "Luxembourg", "Madagascar", "Malaysia", "Maldives", "Mali",
  "Malta", "Mexico", "Moldova", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria",
  "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palestine", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saudi Arabia", "Senegal", "Serbia", "Sierra Leone",
  "Singapore", "Slovakia", "Slovenia", "Somalia", "South Africa", "South Korea", "South Sudan",
  "Spain", "Sri Lanka", "Sudan", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
  "Tanzania", "Thailand", "Timor-Leste", "Togo", "Trinidad and Tobago", "Tunisia", "Turkey",
  "Turkmenistan", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Yemen", "Zambia",
  "Zimbabwe",
] as const;
