import { ProgramPaymentsClient } from "./ProgramPaymentsClient";

function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export default async function ProgramPaymentsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const programName = formatProgramName(programId);

  return <ProgramPaymentsClient programId={programId} programName={programName} />;
}