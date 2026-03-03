import { use } from "react";
import { programs } from "@/app/components/navbar/ProgramSelect";
import { ProgramCertificatesTable, type ProgramCertificate } from "@/app/components/programCertificatesMasterData/ProgramCertificatesTable";

// --- UTILITY ---
function getProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  if (!Array.isArray(programs)) return "Selected Program";
  const program = programs.find((item: any) => item.id === programId);
  return program?.name ?? "Selected Program";
}

// --- LOCAL MOCK DATA ---
const MOCK_CERTIFICATES: ProgramCertificate[] = [
  {
    id: 1,
    award: "Best Delegate",
    templateType: "Award Certificate",
    issueDate: "2025-12-20",
    published: true,
    status: "Active",
  },
  {
    id: 2,
    award: "Participation",
    templateType: "Participation Certificate",
    issueDate: "2025-12-25",
    published: false,
    status: "Active",
  },
  {
    id: 3,
    award: "Mentor Appreciation",
    templateType: "Special Recognition",
    issueDate: "2026-01-05",
    published: false,
    status: "Inactive",
  },
];

export default async function ProgramCertificatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const programName = getProgramName(resolvedParams.programId);
  const searchQuery = resolvedSearchParams.search?.toLowerCase() || "";

  const filteredData = MOCK_CERTIFICATES.filter((certificate) => {
    if (!searchQuery) return true;
    return (
      certificate.award.toLowerCase().includes(searchQuery) ||
      certificate.templateType.toLowerCase().includes(searchQuery) ||
      certificate.issueDate.toLowerCase().includes(searchQuery) ||
      (certificate.published ? "published" : "draft").includes(searchQuery) ||
      certificate.status.toLowerCase().includes(searchQuery)
    );
  });

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="mt-1 text-lg font-bold text-zinc-900">
              {programName} Program Certificates
            </h1>
            <p className="text-sm text-zinc-500">
              Configure and manage program certificate templates and publish status.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ProgramCertificatesTable data={filteredData} currentSearch={searchQuery} />
      </section>
    </main>
  );
}