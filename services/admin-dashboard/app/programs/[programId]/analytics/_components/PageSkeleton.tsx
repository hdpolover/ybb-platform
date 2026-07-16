// app/programs/[programId]/analytics/_components/PageSkeleton.tsx

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-100 ${className ?? ""}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Sk className="h-64" />
        <Sk className="h-64" />
      </div>
      <Sk className="h-72" />
    </div>
  );
}
