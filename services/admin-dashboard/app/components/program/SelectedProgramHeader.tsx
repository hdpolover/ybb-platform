import React from "react";
import Image from "next/image";

export type SelectedProgramHeaderProps = {
  program: {
    id: string;
    name: string;
    shortName: string;
    logoPath: string;
  };
  subtitle: string;
};

export function SelectedProgramHeader({ program, subtitle }: SelectedProgramHeaderProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden">
            <Image
              src={program.logoPath}
              alt={program.shortName}
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{program.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">Program ID</span>
          <span>{program.id}</span>
        </div>
      </div>
    </section>
  );
}
