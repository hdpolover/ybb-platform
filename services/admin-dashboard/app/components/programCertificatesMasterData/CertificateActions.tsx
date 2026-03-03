"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import type { ProgramCertificate, CertificateStatus } from "./ProgramCertificatesTable";

// SEARCH COMPONENT (Shareable URL State & Full Width)
export function CertificateSearch({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchTerm) {
        params.set("search", searchTerm);
      } else {
        params.delete("search");
      }
      router.push(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, pathname, router, searchParams]);

  return (
    <div className="w-full">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search by award, template type, or issue date..."
        className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// FORM MODAL COMPONENT (Add & Edit)
function CertificateFormModal({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: ProgramCertificate;
}) {
  const isEditMode = !!initialData;

  const [award, setAward] = useState(initialData?.award ?? "");
  const [templateType, setTemplateType] = useState(initialData?.templateType ?? "Participation Certificate");
  const [issueDate, setIssueDate] = useState(initialData?.issueDate ?? "");
  const [published, setPublished] = useState<boolean>(initialData?.published ?? false);
  const [status, setStatus] = useState<CertificateStatus>(initialData?.status ?? "Active");

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log(isEditMode ? "Edit Certificate Submitted" : "Add Certificate Submitted", {
      award,
      templateType,
      issueDate,
      published,
      status,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 text-left">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditMode ? "Edit Certificate" : "Add Certificate"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditMode
                ? "Update certificate template, issue date, and publish status."
                : "Create a new certificate configuration for this program."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          <form id="certificate-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div className="border-b border-zinc-200 pb-3 mb-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Basic Information</h4>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Award <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={award}
                    onChange={(e) => setAward(e.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g., Best Delegate"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Template Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={templateType}
                    onChange={(e) => setTemplateType(e.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    <option value="Award Certificate">Award Certificate</option>
                    <option value="Participation Certificate">Participation Certificate</option>
                    <option value="Special Recognition">Special Recognition</option>
                    <option value="Digital Only">Digital Only</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="border-b border-zinc-200 pb-3 mb-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Configuration & Status</h4>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="flex flex-col justify-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-zinc-700">Published Status</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Control certificate visibility.</div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm border border-zinc-200 hover:bg-zinc-50"
                      onClick={() => setPublished((prev) => !prev)}
                    >
                      {published ? (
                        <>
                          <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                          <span>Published</span>
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-4 w-4 text-zinc-500" />
                          <span>Draft</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CertificateStatus)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="certificate-form"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            {isEditMode ? "Save Changes" : "Add Certificate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// DETAIL MODAL COMPONENT (View)
function CertificateDetailModal({
  isOpen,
  onClose,
  certificate,
}: {
  isOpen: boolean;
  onClose: () => void;
  certificate: ProgramCertificate;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6 text-left">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Certificate Details</h3>
            <p className="mt-1 text-sm text-zinc-500">Overview of the certificate configuration and status.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-500">Award Title</div>
              <div className="text-sm font-semibold text-zinc-900">{certificate.award}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-500">Template Type</div>
              <div className="text-sm font-semibold text-zinc-900">{certificate.templateType}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-500">Issue Date</div>
              <div className="text-sm font-semibold text-zinc-900">{certificate.issueDate || "—"}</div>
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-5 grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-zinc-500">Publish Status</div>
              <div>
                {certificate.published ? (
                  <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircleIcon className="h-4 w-4" />
                    <span>Published</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
                    <XCircleIcon className="h-4 w-4" />
                    <span>Draft</span>
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-zinc-500">System Status</div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                    certificate.status === "Active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {certificate.status === "Active" ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <XCircleIcon className="h-4 w-4" />
                  )}
                  <span>{certificate.status}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ACTION BUTTON EXPORTS (SOLID COLORS, NO BORDERS/SHADOWS)
export function AddCertificateAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        <PlusIcon className="h-4 w-4" />
        <span>Add Certificate</span>
      </button>
      <CertificateFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function ViewCertificateAction({ certificate }: { certificate: ProgramCertificate }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-600 transition hover:bg-sky-100 hover:text-sky-700"
        aria-label="View details"
      >
        <EyeIcon className="h-4 w-4" />
      </button>
      <CertificateDetailModal isOpen={isOpen} onClose={() => setIsOpen(false)} certificate={certificate} />
    </>
  );
}

export function EditCertificateAction({ certificate }: { certificate: ProgramCertificate }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
        aria-label="Edit certificate"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <CertificateFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialData={certificate} />
    </>
  );
}

export function DeleteCertificateAction({ id }: { id: number }) {
  return (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700"
      aria-label="Delete certificate"
      onClick={() => console.log("Delete", id)}
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}