"use client";

import React from "react";

interface MakePaymentModalProps {
  open: boolean;
  onClose: () => void;
}

export function MakePaymentModal({ open, onClose }: MakePaymentModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-5 text-sm shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Make Payment</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Buat pembayaran manual untuk peserta terpilih.
            </p>
          </div>
          <button
            type="button"
            className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form className="space-y-3 text-[13px]">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Participant
            </label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="">Select participant...</option>
              <option>AYA GAMAL</option>
              <option>Nur Aisyah</option>
              <option>Mohammed Ali</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Amount
              </label>
              <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                <span className="text-zinc-500">Rp</span>
                <input
                  type="number"
                  placeholder="Enter amount"
                  className="w-full border-0 bg-transparent text-zinc-900 outline-none focus:ring-0"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Currency
              </label>
              <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option>IDR - Indonesian Rupiah</option>
                <option>USD - US Dollar</option>
                <option>EUR - Euro</option>
                <option>GBP - British Pound</option>
                <option>JPY - Japanese Yen</option>
                <option>TRY - Turkish Lira</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Payment Description
            </label>
            <input
              type="text"
              placeholder="Deskripsi pembayaran (mis. Fully Funded Registration Fee batch 1)"
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Payment Method
            </label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>Select payment method...</option>
              <option>Debit or Credit Card ( Visa or MasterCard )</option>
              <option>Vakif Bankasi</option>
              <option>BCA</option>
              <option>Paypal</option>
              <option>Debit or Credit Card ( Manual Confirmation )</option>
            </select>
          </div>

          <div className="flex items-start gap-2 text-[11px]">
            <input
              id="agree-terms"
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="agree-terms" className="text-zinc-600">
              I agree to the terms and conditions
            </label>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-600"
            >
              Pay Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
