"use client";

import React, { useState, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowUpRightIcon,
  BanknotesIcon,
  ArrowPathIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import { Button } from "../../ui/Button";
import { MakePaymentModal } from "../modals/MakePaymentModal";

export function PaymentFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State untuk modal
  const [showMakePaymentModal, setShowMakePaymentModal] = useState(false);

  // State lokal untuk input teks agar tidak lag saat mengetik
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");

  // Helper function untuk merakit parameter URL dengan rapi
  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      
      if (value && !value.includes("All ")) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      
      return params.toString();
    },
    [searchParams]
  );

  // Handler eksekusi tombol Search
  const handleSearch = () => {
    const queryString = createQueryString("search", searchTerm);
    router.push(`${pathname}?${queryString}`);
  };

  // Handler eksekusi Enter pada input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Handler eksekusi Dropdown (Otomatis update URL saat dipilih)
  const handleFilterChange = (key: string, value: string) => {
    const queryString = createQueryString(key, value);
    router.push(`${pathname}?${queryString}`);
  };

  // Handler eksekusi Reset
  const handleReset = () => {
    setSearchTerm("");
    router.push(pathname);
  };

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">All Payments</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Daftar seluruh transaksi pembayaran untuk program ini.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => setShowMakePaymentModal(true)}
            startIcon={<ArrowUpRightIcon className="h-3.5 w-3.5" />}
          >
            Make Payment
          </Button>

          <Button 
            variant="secondary" 
            size="sm"
            startIcon={<BanknotesIcon className="h-3.5 w-3.5 text-emerald-500" />}
          >
            Export Data (Excel)
          </Button>

          {/* Tombol Apply Filters opsional jika kamu pakai auto-update di dropdown, tapi bisa dibiarkan sebagai indikator visual */}
          <Button
            size="sm"
            className="bg-blue-50 text-blue-700 border-blue-500 hover:bg-blue-100 shadow-sm border"
            startIcon={<FunnelIcon className="h-3.5 w-3.5" />}
          >
            Filters Active
          </Button>

          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleReset}
            startIcon={<ArrowPathIcon className="h-3.5 w-3.5" />}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-medium text-zinc-700">
          Search
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by participant name, email, transaction ID, payment amount..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <Button 
            variant="blue" 
            className="px-4 py-2"
            onClick={handleSearch}
            startIcon={<MagnifyingGlassIcon className="h-3.5 w-3.5" />}
          >
            Search
          </Button>
        </div>
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">
            Payment Status
          </label>
          <select 
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value={searchParams.get("status") || "All Status"}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <option>All Status</option>
            <option value="created">Created</option>
            <option value="pending">Pending</option>
            <option value="success">Success</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">
            Program Payment
          </label>
          <select 
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value={searchParams.get("type") || "All Program Payments"}
            onChange={(e) => handleFilterChange("type", e.target.value)}
          >
            <option>All Program Payments</option>
            <option value="fully_funded">Fully Funded Registration Fee</option>
            <option value="self_funded">Self Funded Registration Fee</option>
            <option value="batch_1">Batch 1 Installment</option>
            <option value="batch_2">Batch 2 Installment</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">
            Payment Method
          </label>
          <select 
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value={searchParams.get("method") || "All Methods"}
            onChange={(e) => handleFilterChange("method", e.target.value)}
          >
            <option>All Methods</option>
            <option value="card">Debit or Credit Card ( Visa or MasterCard )</option>
            <option value="vakif">Vakif Bankasi</option>
            <option value="bca">BCA</option>
            <option value="paypal">Paypal</option>
            <option value="manual">Debit or Credit Card ( Manual Confirmation )</option>
          </select>
        </div>
      </div>

      <MakePaymentModal
        open={showMakePaymentModal}
        onClose={() => setShowMakePaymentModal(false)}
      />
    </>
  );
}