"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const MOCK_DATA = {
  totalPayment: 528874500,
  netRevenue: 518297010,
  adminFee: 10577490,
};

const CHART_DATA = [
  { name: "Net Revenue", value: MOCK_DATA.netRevenue, color: "#0EA5E9" },
  { name: "Admin Fee", value: MOCK_DATA.adminFee, color: "#A855F7" },
];

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export function PaymentDetailsSection() {
  return (
    <section className="flex h-auto lg:h-full flex-col justify-between rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-zinc-900">Payment Details</h3>
        
        <div className="relative flex h-24 w-full justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={CHART_DATA}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={45}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                {CHART_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => formatIDR(Number(value))}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-sky-500"></div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-900">Net Revenue</span>
                <span className="text-xs text-zinc-500">Received by YBB</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-zinc-700">
              {formatIDR(MOCK_DATA.netRevenue)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-purple-500"></div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-900">Admin Fee</span>
                <span className="text-xs text-zinc-500">Midtrans — ±2%</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-zinc-700">
              {formatIDR(MOCK_DATA.adminFee)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 lg:mt-auto border-t border-zinc-100 pt-4">
         <div className="flex items-center justify-between">
            <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-900">Total Payments</span>
                <span className="text-[10px] text-zinc-500">Paid by participants</span>
            </div>
            <span className="text-sm font-bold text-zinc-900">{formatIDR(MOCK_DATA.totalPayment)}</span>
         </div>
      </div>
    </section>
  );
}