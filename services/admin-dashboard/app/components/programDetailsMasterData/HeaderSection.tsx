interface HeaderSectionProps {
  programName: string;
}

export function HeaderSection({ programName }: HeaderSectionProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            <span>Master Data</span>
          </div>
          <h1 className="mt-1 text-lg font-bold text-zinc-900">
            {programName} Program Details
          </h1>
          <p className="text-sm text-zinc-500">
            Review live program data and manage program-admin operational settings for this program.
          </p>
        </div>
      </div>
    </section>
  );
}