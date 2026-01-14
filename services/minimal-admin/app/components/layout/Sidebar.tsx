"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, BuildingStorefrontIcon, RectangleStackIcon, UsersIcon, ArrowLeftOnRectangleIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/contexts/AuthContext";

const navigation = [
    { name: "Dashboard", href: "/", icon: HomeIcon },
    { name: "Brands", href: "/brands", icon: BuildingStorefrontIcon },
    { name: "Programs", href: "/programs", icon: RectangleStackIcon },
    { name: "Users", href: "/users", icon: UsersIcon },
    { name: "Landing", href: "/landing", icon: GlobeAltIcon },
];

export function Sidebar() {
    const pathname = usePathname();
    const { logout } = useAuth();

    return (
        <div className="flex h-full w-64 flex-col border-r border-zinc-200 bg-white">
            <div className="flex h-16 items-center border-b border-zinc-200 px-6">
                <span className="text-lg font-bold text-zinc-900">YBB Admin</span>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                <nav className="mt-1 space-y-1 px-2">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        "mr-3 h-5 w-5 flex-shrink-0",
                                        isActive ? "text-blue-700" : "text-zinc-400 group-hover:text-zinc-500"
                                    )}
                                    aria-hidden="true"
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>
            <div className="border-t border-zinc-200 p-4">
                <button
                    onClick={logout}
                    className="group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium text-zinc-700 hover:bg-red-50 hover:text-red-700"
                >
                    <ArrowLeftOnRectangleIcon
                        className="mr-3 h-5 w-5 text-zinc-400 group-hover:text-red-500"
                        aria-hidden="true"
                    />
                    Sign out
                </button>
            </div>
        </div>
    );
}
