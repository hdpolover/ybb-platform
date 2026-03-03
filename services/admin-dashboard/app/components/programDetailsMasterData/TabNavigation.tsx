import Link from "next/link";

export function TabNavigation({ activeTab }: { activeTab: string }) {
  return (
    <div className="inline-flex gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1">
      <Link
        href="?tab=general"
        className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
          activeTab === "general"
            ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
            : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        General Information
      </Link>
      <Link
        href="?tab=specifics"
        className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
          activeTab === "specifics"
            ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
            : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        Program Specifics
      </Link>
    </div>
  );
}