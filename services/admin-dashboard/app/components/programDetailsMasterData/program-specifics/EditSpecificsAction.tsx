"use client";

import { useState } from "react";
import { PencilSquareIcon } from "@heroicons/react/24/solid";
import { EditProgramSpecificsModal } from "./EditProgramSpecificsModal";

interface EditSpecificsActionProps {
  programName: string;
}

export function EditSpecificsAction({ programName }: EditSpecificsActionProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="edit-specifics-modal"
      >
        <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
        <span>Edit Program Specifics</span>
      </button>

      {isOpen && (
        <EditProgramSpecificsModal
          programName={programName}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}