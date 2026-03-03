import Link from "next/link";

export function TabNavigation({ activeTab }: { activeTab: string }) {
  const getLinkStyle = (tabName: string) =>
    `rounded-md px-4 py-2 text-sm font-semibold transition-all ${
      activeTab === tabName
        ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
        : "text-zinc-500 hover:text-zinc-700"
    }`;

  return (
    <div className="inline-flex gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1">
      <Link href="?tab=categories" className={getLinkStyle("categories")} replace>
        Participation Categories
      </Link>
      <Link href="?tab=subthemes" className={getLinkStyle("subthemes")} replace>
        Sub Themes
      </Link>
      <Link href="?tab=essays" className={getLinkStyle("essays")} replace>
        Essays
      </Link>
    </div>
  );
}