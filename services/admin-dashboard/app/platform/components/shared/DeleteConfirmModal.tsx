"use client";

import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";

type DeleteConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  itemName?: string;
  warningMessage?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
};

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  warningMessage,
  isSubmitting = false,
  errorMessage,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        {/* Bagian header modal konfirmasi */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Isi konten penjelasan dan warning */}
        <div className="px-6 py-4">
          <p className="mb-3 text-sm text-zinc-700">{message}</p>

          {errorMessage ? (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2">
              <p className="text-xs text-red-700">{errorMessage}</p>
            </div>
          ) : null}

          {itemName && (
            <div className="mb-3 rounded-md bg-zinc-50 px-3 py-2">
              <p className="text-sm font-medium text-zinc-900">{itemName}</p>
            </div>
          )}

          {warningMessage && (
            <div className="rounded-md bg-red-50 px-3 py-2">
              <p className="text-xs text-red-700">{warningMessage}</p>
            </div>
          )}
        </div>

        {/* Tombol aksi buat batal atau lanjut hapus */}
        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {isSubmitting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
