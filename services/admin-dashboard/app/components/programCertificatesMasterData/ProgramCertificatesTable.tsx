import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import {
  CertificateSearch,
  AddCertificateAction,
  ViewCertificateAction,
  EditCertificateAction,
  DeleteCertificateAction,
} from "./CertificateActions";

// TYPES
export type CertificateStatus = "Active" | "Inactive";

export type ProgramCertificate = {
  id: number;
  award: string;
  templateType: string;
  issueDate: string;
  published: boolean;
  status: CertificateStatus;
};

// MAIN SERVER COMPONENT
export function ProgramCertificatesTable({
  data,
  currentSearch,
}: {
  data: ProgramCertificate[];
  currentSearch: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search Certificates</label>
          <div className="flex w-full gap-4">
            <CertificateSearch initialSearch={currentSearch} />
            <AddCertificateAction />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">No</th>
              <th className="px-6 py-4 font-semibold">Award</th>
              <th className="px-6 py-4 font-semibold">Template Type</th>
              <th className="px-6 py-4 font-semibold">Issue Date</th>
              <th className="px-6 py-4 font-semibold">Published</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-2">
                    <span className="font-semibold text-zinc-900">No certificates found</span>
                    <span className="text-xs text-zinc-500">
                      Adjust your search or use the Add Certificate button to create one.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((certificate, index) => (
                <tr key={certificate.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-4 align-middle text-xs font-medium text-zinc-500">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 align-middle font-semibold text-zinc-900">
                    {certificate.award}
                  </td>
                  <td className="px-6 py-4 align-middle text-zinc-700">
                    {certificate.templateType}
                  </td>
                  <td className="px-6 py-4 align-middle text-zinc-700">
                    {certificate.issueDate || "—"}
                  </td>
                  <td className="px-6 py-4 align-middle">
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
                  </td>
                  <td className="px-6 py-4 align-middle">
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
                  </td>
                  <td className="px-6 py-4 align-middle text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <ViewCertificateAction certificate={certificate} />
                      <EditCertificateAction certificate={certificate} />
                      <DeleteCertificateAction id={certificate.id} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}