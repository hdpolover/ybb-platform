"use client";

import React from "react";
import { Button } from "@/app/components/ui/Button";

interface UpdatePaymentStatusModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpdatePaymentStatusModal({ open, onClose }: UpdatePaymentStatusModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 text-sm shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Update Payment Status</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Choose a new status for this payment and optionally add additional notes.
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-700"
            onClick={onClose}
          >
            ✕
          </Button>
        </div>

        <form className="space-y-3 text-[13px]">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Status</label>
            <select
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              defaultValue="Cancelled"
            >
              <option value="Created">Created</option>
              <option value="Pending">Pending</option>
              <option value="Success">Success</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Additional Notes
            </label>
            <textarea
              rows={3}
              placeholder="Optional notes about why this status is updated..."
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={onClose}
            >
              Cancel
            </Button>
            
            <Button 
              type="submit" 
              variant="blue" 
              size="sm"
            >
              Update Status
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}