"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "next/navigation";

export function AccountMenu() {
  const { adminProfile, logout } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleSignOut = () => {
    logout();
    router.push("/login");
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center text-xs text-zinc-600"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 hover:bg-zinc-100"
      >
        <div className="flex flex-col items-end leading-tight">
          <span className="text-[12px] font-semibold text-zinc-800">
            {adminProfile?.fullName || "Admin User"}
          </span>
          <span className="text-[12px] text-zinc-500">{adminProfile?.roleName || "Administrator"}</span>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
          {adminProfile?.fullName.split(' ').map(n => n[0]).join('').toUpperCase() || "AD"}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[115%] z-20 w-60 rounded-md border border-zinc-200 bg-white py-2 text-xs shadow-lg origin-top transform transition-all duration-200 ease-out animate-[fadeIn_0.18s_ease-out]">
          <div className="px-3 pb-2">
            <div className="text-[11px] font-semibold text-zinc-800">
              {adminProfile?.fullName.split(' ').map(n => n[0]).join('').toUpperCase() || "AD"}
            </div>
            <div className="text-[11px] text-zinc-500">
              {adminProfile?.fullName || "Admin User"}
            </div>
            <div className="text-[11px] text-zinc-500">{adminProfile?.roleName || "Administrator"}</div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {adminProfile?.email || "admin@ybb.com"}
            </div>
          </div>

          <div className="my-1 border-t border-zinc-100" />

          <nav className="flex flex-col gap-0.5 px-1 pb-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-zinc-50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-3.5 w-3.5 text-zinc-500"
                fill="currentColor"
              >
                <path d="M10 10a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" />
                <path d="M3 15.25A3.25 3.25 0 0 1 6.25 12h7.5A3.25 3.25 0 0 1 17 15.25 1.75 1.75 0 0 1 15.25 17h-10A1.75 1.75 0 0 1 3 15.25Z" />
              </svg>
              <span>My Profile</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-zinc-50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-3.5 w-3.5 text-zinc-500"
                fill="currentColor"
              >
                <path d="M11.983 3.048a2 2 0 0 0-3.966 0l-.146.878a1 1 0 0 1-.595.76l-.82.328a2 2 0 0 0-1.048 2.727l.39.78a1 1 0 0 1 0 .894l-.39.78a2 2 0 0 0 1.048 2.727l.82.328a1 1 0 0 1 .595.76l.146.878a2 2 0 0 0 3.966 0l.146-.878a1 1 0 0 1 .595-.76l.82-.328a2 2 0 0 0 1.048-2.727l-.39-.78a1 1 0 0 1 0-.894l.39-.78a2 2 0 0 0-1.048-2.727l-.82-.328a1 1 0 0 1-.595-.76Zm-1.983 3.452a2.5 2.5 0 1 1-2.5 2.5 2.5 2.5 0 0 1 2.5-2.5Z" />
              </svg>
              <span>System Settings</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-zinc-50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-3.5 w-3.5 text-zinc-500"
                fill="currentColor"
              >
                <path d="M6.5 8a2.5 2.5 0 1 0-2.5-2.5A2.5 2.5 0 0 0 6.5 8Zm7 0A2.5 2.5 0 1 0 11 5.5 2.5 2.5 0 0 0 13.5 8ZM3 13.25A2.25 2.25 0 0 1 5.25 11h2.5A2.25 2.25 0 0 1 10 13.25v.5A1.25 1.25 0 0 1 8.75 15h-5A1.25 1.25 0 0 1 2.5 13.75Z" />
                <path d="M11.75 11A2.25 2.25 0 0 0 9.5 13.25v.5A1.25 1.25 0 0 0 10.75 15h4.5A1.25 1.25 0 0 0 16.5 13.75 2.75 2.75 0 0 0 13.75 11Z" />
              </svg>
              <span>Admin Management</span>
            </button>
          </nav>

          <div className="mt-1 border-t border-zinc-100" />

          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 px-3 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-3.5 w-3.5 text-red-600"
              fill="currentColor"
            >
              <path d="M8.5 4A1.5 1.5 0 0 0 7 5.5v1a.75.75 0 0 1-1.5 0v-1A3 3 0 0 1 8.5 2h3A3 3 0 0 1 14.5 5v10A3 3 0 0 1 11.5 18h-3A3 3 0 0 1 5.5 15.5v-1a.75.75 0 0 1 1.5 0v1A1.5 1.5 0 0 0 8.5 17h3A1.5 1.5 0 0 0 13 15.5v-10A1.5 1.5 0 0 0 11.5 4Z" />
              <path d="M4.72 7.47a.75.75 0 0 1 1.06 0L7.78 9.47a.75.75 0 0 1 0 1.06l-2 2a.75.75 0 1 1-1.06-1.06L6.19 10 4.72 8.53a.75.75 0 0 1 0-1.06Z" />
              <path d="M2.5 10a.75.75 0 0 1 .75-.75H7a.75.75 0 0 1 0 1.5H3.25A.75.75 0 0 1 2.5 10Z" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
