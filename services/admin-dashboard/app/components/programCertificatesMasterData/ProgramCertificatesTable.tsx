"use client";

import { useState } from "react";
import {
  CheckCircleIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

export type CertificateStatus = "Active" | "Inactive";

export type ProgramCertificate = {
  id: number;
  award: string; // e.g., "Best Delegate"
  templateType: string; // e.g., "Participation", "Award", "Digital Only"
  issueDate: string; // formatted date string
  published: boolean;
  status: CertificateStatus;
};

const mockCertificates: ProgramCertificate[] = [
  {
    id: 1,
    award: "Best Delegate",
    templateType: "Award Certificate",
    issueDate: "Dec 20, 2025",
    published: true,
    status: "Active",
  },
  {
    id: 2,
    award: "Participation",
    templateType: "Participation Certificate",
    issueDate: "Dec 25, 2025",
    published: false,
    status: "Active",
  },
  {
    id: 3,
    award: "Mentor Appreciation",
    templateType: "Special Recognition",
    issueDate: "Jan 05, 2026",
    published: false,
    status: "Inactive",
  },
];

export function ProgramCertificatesTable() {
  const [certificates] = useState<ProgramCertificate[]>(mockCertificates);
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<ProgramCertificate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<ProgramCertificate | null>(null);

  const filteredCertificates = certificates.filter((certificate) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      certificate.award.toLowerCase().includes(q) ||
      certificate.templateType.toLowerCase().includes(q) ||
      certificate.issueDate.toLowerCase().includes(q) ||
      (certificate.published ? "published" : "draft").includes(q) ||
      certificate.status.toLowerCase().includes(q)
    );
  });

  return (
    <section className="space-y-3 text-xs text-zinc-700 md:text-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program Certificates</h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Manage certificate templates, publish status, and availability for this program.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={() => {
            setEditingCertificate(null);
            setShowFormModal(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Certificate</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by award, template type, or issue date..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs md:text-sm">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">No</th>
              <th className="px-3 py-2">Award</th>
              <th className="px-3 py-2">Template Type</th>
              <th className="px-3 py-2">Issue Date</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCertificates.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-[12px] text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No certificate templates configured yet</span>
                    <span className="text-[11px] text-zinc-400">
                      Use the Add Certificate button to create program certificates.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredCertificates.map((certificate, index) => (
                <tr
                  key={certificate.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2 align-top font-medium text-zinc-900">
                    {certificate.award}
                  </td>
                  <td className="px-3 py-2 align-top text-zinc-700">
                    {certificate.templateType}
                  </td>
                  <td className="px-3 py-2 align-top text-zinc-700">
                    {certificate.issueDate}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {certificate.published ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        <span>Published</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200">
                        <XCircleIcon className="h-3.5 w-3.5" />
                        <span>Draft</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        certificate.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                          : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                      }`}
                    >
                      {certificate.status === "Active" ? (
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                      ) : (
                        <XCircleIcon className="h-3.5 w-3.5" />
                      )}
                      <span>{certificate.status}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100"
                        aria-label="View certificate details"
                        onClick={() => {
                          setSelectedCertificate(certificate);
                          setShowDetailModal(true);
                        }}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                        aria-label="Edit certificate"
                        onClick={() => {
                          setEditingCertificate(certificate);
                          setShowFormModal(true);
                        }}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                        aria-label="Delete certificate"
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
        <ProgramCertificateFormModal
          mode={editingCertificate ? "edit" : "add"}
          initialValues={editingCertificate ?? undefined}
          onClose={() => {
            setShowFormModal(false);
            setEditingCertificate(null);
          }}
        />
      )}

      {showDetailModal && selectedCertificate && (
        <ProgramCertificateDetailModal
          certificate={selectedCertificate}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCertificate(null);
          }}
        />
      )}
    </section>
  );
}

type CertificateFormMode = "add" | "edit";

interface ProgramCertificateFormModalProps {
  onClose: () => void;
  mode?: CertificateFormMode;
  initialValues?: ProgramCertificate;
}

function ProgramCertificateFormModal({
  onClose,
  mode = "add",
  initialValues,
}: ProgramCertificateFormModalProps) {
  const [award, setAward] = useState(initialValues?.award ?? "");
  const [templateType, setTemplateType] = useState(initialValues?.templateType ?? "Participation Certificate");
  const [issueDate, setIssueDate] = useState(initialValues?.issueDate ?? "");
  const [published, setPublished] = useState<boolean>(initialValues?.published ?? false);
  const [status, setStatus] = useState<CertificateStatus>(initialValues?.status ?? "Active");

  const isEditMode = mode === "edit";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: ProgramCertificate = {
      id: initialValues?.id ?? Date.now(),
      award,
      templateType,
      issueDate,
      published,
      status,
    };
    // TODO: integrate with backend / parent state
    console.log(isEditMode ? "Edit program certificate:" : "Create program certificate:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Certificate" : "Add Certificate"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update certificate template, issue date, and publish status."
                : "Create a new certificate configuration for this program."}
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
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Award <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={award}
                  onChange={(event) => setAward(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., Best Delegate"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Template Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={templateType}
                  onChange={(event) => setTemplateType(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Award Certificate">Award Certificate</option>
                  <option value="Participation Certificate">Participation Certificate</option>
                  <option value="Special Recognition">Special Recognition</option>
                  <option value="Digital Only">Digital Only</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Issue Date
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Published
                  </div>
                  <div className="text-[11px] text-zinc-600">
                    Control whether this certificate is visible to participants.
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                  onClick={() => setPublished((previous) => !previous)}
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
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as CertificateStatus)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
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
              {isEditMode ? "Save Changes" : "Add Certificate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProgramCertificateDetailModalProps {
  certificate: ProgramCertificate;
  onClose: () => void;
}

function ProgramCertificateDetailModal({
  certificate,
  onClose,
}: ProgramCertificateDetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Certificate Details</h3>
            <p className="text-[11px] text-zinc-500">Overview of the certificate configuration and status.</p>
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

        <div className="space-y-4 px-4 py-3">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Award
            </div>
            <div className="text-sm font-semibold text-zinc-900 md:text-base">
              {certificate.award}
            </div>
            <div className="text-[11px] text-zinc-600 md:text-xs">
              {certificate.templateType}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Issue Date
              </div>
              <div className="text-sm font-medium text-zinc-900">
                {certificate.issueDate || "—"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Published
              </div>
              <div>
                {certificate.published ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    <span>Published</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200">
                    <XCircleIcon className="h-3.5 w-3.5" />
                    <span>Draft</span>
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  certificate.status === "Active"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                }`}
              >
                {certificate.status === "Active" ? (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                ) : (
                  <XCircleIcon className="h-3.5 w-3.5" />
                )}
                <span>{certificate.status}</span>
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
