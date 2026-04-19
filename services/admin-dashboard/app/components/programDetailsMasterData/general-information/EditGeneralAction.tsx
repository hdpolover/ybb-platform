// app/programs/[programId]/master-data/program-details/_components/EditGeneralAction.tsx
"use client";

import { useState } from "react";
import { PencilSquareIcon } from "@heroicons/react/24/solid";
import { EditGeneralInformationModal, type GeneralInformationFormValues } from "./EditGeneralInformationModal";

interface EditGeneralActionProps {
  programId: string;
  brandId: string;
  programName: string;
  initialValues: GeneralInformationFormValues;
  currentLogoUrl?: string | null;
  currentBannerUrl?: string | null;
  currentThumbnailUrl?: string | null;
  onSave: (values: GeneralInformationFormValues) => Promise<void>;
  onBrandingUploaded?: () => void;
  isSaving: boolean;
  errorMessage: string | null;
}

export function EditGeneralAction({
  programId,
  brandId,
  programName,
  initialValues,
  currentLogoUrl,
  currentBannerUrl,
  currentThumbnailUrl,
  onSave,
  onBrandingUploaded,
  isSaving,
  errorMessage,
}: EditGeneralActionProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleSubmit = async (values: GeneralInformationFormValues) => {
    await onSave(values);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="edit-general-modal"
      >
        <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
        <span>Edit General Information</span>
      </button>

      <EditGeneralInformationModal
        open={isOpen}
        programId={programId}
        brandId={brandId}
        programName={programName}
        initialValues={initialValues}
        currentLogoUrl={currentLogoUrl}
        currentBannerUrl={currentBannerUrl}
        currentThumbnailUrl={currentThumbnailUrl}
        onSubmit={handleSubmit}
        onBrandingUploaded={onBrandingUploaded}
        isSaving={isSaving}
        errorMessage={errorMessage}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
