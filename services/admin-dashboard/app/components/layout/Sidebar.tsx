"use client";

import Image from "next/image";
import React, { useState } from "react";

export type SidebarItem = {
  label: string;
  active?: boolean;
};

const sidebarItems: SidebarItem[] = [
  { label: "Dashboard" },
  { label: "Users" },
  { label: "Payments" },
  { label: "Settings" },
];

function SidebarIcon({ label }: { label: string }) {
  const baseClass = "h-4 w-4 flex-none text-blue-100";

  if (label === "Dashboard") {
    return (
      <svg
        aria-hidden="true"
        className={baseClass}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M3 9.5A1.5 1.5 0 0 1 4.5 8h3A1.5 1.5 0 0 1 9 9.5v6A1.5 1.5 0 0 1 7.5 17h-3A1.5 1.5 0 0 1 3 15.5v-6Z" />
        <path d="M11 4.5A1.5 1.5 0 0 1 12.5 3h3A1.5 1.5 0 0 1 17 4.5v11A1.5 1.5 0 0 1 15.5 17h-3A1.5 1.5 0 0 1 11 15.5v-11Z" />
      </svg>
    );
  }

  if (label === "Users") {
    return (
      <svg
        aria-hidden="true"
        className={baseClass}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M10 10a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" />
        <path d="M3 15.25A3.25 3.25 0 0 1 6.25 12h7.5A3.25 3.25 0 0 1 17 15.25 1.75 1.75 0 0 1 15.25 17h-10A1.75 1.75 0 0 1 3 15.25Z" />
      </svg>
    );
  }

  if (label === "Payments") {
    return (
      <svg
        aria-hidden="true"
        className={baseClass}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M3 5.75A2.75 2.75 0 0 1 5.75 3h8.5A2.75 2.75 0 0 1 17 5.75v8.5A2.75 2.75 0 0 1 14.25 17h-8.5A2.75 2.75 0 0 1 3 14.25Zm1.5 1v1.5h11V6.75a1.25 1.25 0 0 0-1.25-1.25h-8.5A1.25 1.25 0 0 0 4.5 6.75Zm0 4v3.5a1.25 1.25 0 0 0 1.25 1.25h8.5A1.25 1.25 0 0 0 15.5 14.25v-3.5Z" />
      </svg>
    );
  }

  if (label === "Settings") {
    return (
      <svg
        aria-hidden="true"
        className={baseClass}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M11.983 3.048a2 2 0 0 0-3.966 0l-.146.878a1 1 0 0 1-.595.76l-.82.328a2 2 0 0 0-1.048 2.727l.39.78a1 1 0 0 1 0 .894l-.39.78a2 2 0 0 0 1.048 2.727l.82.328a1 1 0 0 1 .595.76l.146.878a2 2 0 0 0 3.966 0l.146-.878a1 1 0 0 1 .595-.76l.82-.328a2 2 0 0 0 1.048-2.727l-.39-.78a1 1 0 0 1 0-.894l.39-.78a2 2 0 0 0-1.048-2.727l-.82-.328a1 1 0 0 1-.595-.76Zm-1.983 3.452a2.5 2.5 0 1 1-2.5 2.5 2.5 2.5 0 0 1 2.5-2.5Z" />
      </svg>
    );
  }

  return null;
}

export type SidebarProps = {
  collapsed: boolean;
  selectedProgramId: string | null;
};

export function Sidebar({ collapsed, selectedProgramId }: SidebarProps) {
  const [showProgramAlert, setShowProgramAlert] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  function handleClickItem(item: SidebarItem) {
    if (!selectedProgramId) {
      setShowProgramAlert(true);
      return;
    }

    // TODO: nanti ganti dengan navigasi ke halaman sesuai menu
    console.info(
      "Sidebar menu clicked:",
      item.label,
      "for program",
      selectedProgramId,
    );
    setActiveLabel(item.label);
  }
  return (
    <aside
      className={`flex h-screen flex-col bg-blue-600 bg-[url('/img/bg3striplurus.webp')] bg-top bg-no-repeat bg-cover text-white transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-blue-500">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded">
          <Image
            src="/img/logosYBB.webp"
            alt="YBB Platform logo"
            width={36}
            height={36}
            className="object-contain"
          />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">YBB Platform</span>
            <span className="text-[13px] text-blue-100">Admin Dashboard</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4 text-[15px]">
        {sidebarItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`flex w-full items-center rounded-md px-3 py-2 text-left transition-colors ${
              selectedProgramId && activeLabel === item.label
                ? "bg-white text-blue-700 shadow-sm"
                : "text-blue-100 hover:bg-blue-500/60 hover:text-white"
            }`}
            onClick={() => handleClickItem(item)}
          >
            <span className="mr-2">
              <SidebarIcon label={item.label} />
            </span>
            <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
          </button>
        ))}
      </nav>

      {showProgramAlert && !collapsed && (
        <div className="mx-3 mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <span>
              Pilih program terlebih dahulu di bagian atas sebelum mengakses menu
              di sidebar.
            </span>
            <button
              type="button"
              className="ml-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900"
              onClick={() => setShowProgramAlert(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-blue-500 px-4 py-3 text-xs text-blue-100">
        {!collapsed && (
          <>
            <div>Logged in as</div>
            <div className="text-sm font-medium text-white">Admin</div>
          </>
        )}
      </div>
    </aside>
  );
}
