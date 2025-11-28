"use client";

import React from "react";
import { ProgramSelect } from "../navbar/ProgramSelect";
import { AccountMenu } from "../navbar/AccountMenu";

export type NavbarProps = {
  onToggleSidebar: () => void;
  selectedProgramId: string | null;
  onChangeProgram: (programId: string | null) => void;
};

export function Navbar({
  onToggleSidebar,
  selectedProgramId,
  onChangeProgram,
}: NavbarProps) {
  return (
    <header className="flex h-16 items-center border-b bg-white px-6 shadow-sm">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
        aria-label="Toggle sidebar"
      >
        <span className="flex h-3 w-4 flex-col justify-between">
          <span className="h-[2px] w-full rounded bg-zinc-700" />
          <span className="h-[2px] w-full rounded bg-zinc-700" />
          <span className="h-[2px] w-full rounded bg-zinc-700" />
        </span>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <ProgramSelect
          selectedProgramId={selectedProgramId}
          onChangeSelectedProgram={onChangeProgram}
        />
        <AccountMenu />
      </div>
    </header>
  );
}
