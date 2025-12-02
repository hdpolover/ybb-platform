import { use } from "react";

export default function ScoringPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Scoring</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage scoring criteria and evaluations for this program
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-8">
        <div className="text-center">
          <p className="text-zinc-500">
            Scoring management functionality coming soon...
          </p>
          <p className="mt-2 text-xs text-zinc-400">Program ID: {programId}</p>
        </div>
      </div>
    </div>
  );
}
