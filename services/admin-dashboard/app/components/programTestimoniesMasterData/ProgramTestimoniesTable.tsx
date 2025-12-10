"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { PencilSquareIcon, PlusIcon, TrashIcon, UserCircleIcon } from "@heroicons/react/24/solid";

export type ProgramTestimonyRow = {
  id: number;
  name: string;
  role: string;
  country: string;
  photoUrl?: string;
  testimony: string;
};

const mockTestimonies: ProgramTestimonyRow[] = [
  {
    id: 1,
    name: "Aisyah Putri Fadhilah",
    role: "Delegate - Japan Youth Summit 2025",
    country: "Indonesia",
    photoUrl: undefined,
    testimony:
      "Participating in Japan Youth Summit helped me grow my global network and confidence to lead social projects back home.",
  },
  {
    id: 2,
    name: "Michael Tan",
    role: "Alumnus - Turkey Youth Summit 2024",
    country: "Singapore",
    photoUrl: undefined,
    testimony:
      "The program gave me real exposure to international collaboration and cross-cultural teamwork.",
  },
];

export function ProgramTestimoniesTable() {
  const [rows] = useState<ProgramTestimonyRow[]>(mockTestimonies);
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRow, setEditingRow] = useState<ProgramTestimonyRow | null>(null);

  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.name.toLowerCase().includes(q) ||
      row.role.toLowerCase().includes(q) ||
      row.country.toLowerCase().includes(q) ||
      row.testimony.toLowerCase().includes(q)
    );
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program Testimonies</h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Manage testimonial stories from delegates and alumni for this program.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={() => {
            setEditingRow(null);
            setShowFormModal(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Testimony</span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, role, or country..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-sm md:text-sm">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-12 px-3 py-2">No</th>
              <th className="w-20 px-3 py-2">Photo</th>
              <th className="px-3 py-2">Person Details</th>
              <th className="px-3 py-2">Testimony</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-[12px] text-zinc-500"
                >
                  No testimonies configured yet.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50"
                >
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-50">
                      {row.photoUrl ? (
                        <Image
                          src={row.photoUrl}
                          alt={row.name}
                          width={48}
                          height={48}
                          className="h-12 w-12 object-cover"
                        />
                      ) : (
                        <UserCircleIcon className="h-10 w-10 text-zinc-300" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-zinc-900">{row.name}</div>
                      <div className="text-[11px] text-zinc-500">{row.role}</div>
                      <div className="text-[11px] text-zinc-500">{row.country}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="max-w-md text-[11px] text-zinc-700 line-clamp-4 md:max-w-xl">
                      {row.testimony}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                        aria-label="Edit testimony"
                        onClick={() => {
                          setEditingRow(row);
                          setShowFormModal(true);
                        }}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                        aria-label="Delete testimony"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showFormModal && (
        <ProgramTestimonyFormModal
          mode={editingRow ? "edit" : "add"}
          initialValues={editingRow ?? undefined}
          onClose={() => {
            setShowFormModal(false);
            setEditingRow(null);
          }}
        />
      )}
    </section>
  );
}

interface ProgramTestimonyFormModalProps {
  onClose: () => void;
  mode?: "add" | "edit";
  initialValues?: ProgramTestimonyRow;
}

function ProgramTestimonyFormModal({
  onClose,
  mode = "add",
  initialValues,
}: ProgramTestimonyFormModalProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [role, setRole] = useState(initialValues?.role ?? "");
  const [country, setCountry] = useState(initialValues?.country ?? "");
  const [testimony, setTestimony] = useState(initialValues?.testimony ?? "");
  const [selectedImageName, setSelectedImageName] = useState<string | null>(
    initialValues?.photoUrl ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isEditMode = mode === "edit";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name,
      role,
      country,
      testimony,
      photoFileName: selectedImageName,
    };
    // TODO: integrate with backend / parent state
    console.log(isEditMode ? "Edit program testimony:" : "Create program testimony:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Testimony" : "Add Testimony"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the person details and testimonial content."
                : "Add a new testimonial from a delegate or alumnus."}
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                    Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g., Aisyah Putri Fadhilah"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                    Country <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g., Indonesia"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Role / Program <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., Delegate - Japan Youth Summit 2025"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Testimony <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  value={testimony}
                  onChange={(event) => setTestimony(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Write the testimony or story from this person."
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Photo
                </div>
                <button
                  type="button"
                  className="flex h-40 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-center text-[11px] text-zinc-500 hover:border-blue-400 hover:bg-blue-50/40"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <div className="space-y-1 px-4">
                    <div className="text-sm font-medium text-zinc-700">
                      {selectedImageName ? "Image selected" : "Drop image here or click to upload."}
                    </div>
                    {selectedImageName ? (
                      <div className="truncate text-[11px] text-zinc-600">{selectedImageName}</div>
                    ) : (
                      <div>Recommended size: 400x400px. Max size: 2MB</div>
                    )}
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedImageName(file ? file.name : null);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
            >
              {isEditMode ? "Save Changes" : "Add Testimony"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
