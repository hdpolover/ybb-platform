import { redirect } from "next/navigation";

export default async function ScoringPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  redirect(`/programs/${programId}/scoring/fully-funded`);
}
