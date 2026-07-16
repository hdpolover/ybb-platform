"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface PaymentChartSectionProps {
  data: any;
}

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export function PaymentChartSection({ data }: PaymentChartSectionProps) {
  const CHART_DATA = [
    { name: "Program Earnings", value: data.programEarnings, color: "#3B82F6" },
    { name: "Admin Fee", value: data.adminFee, color: "#A855F7" },
  ];

  return (
    <section className="flex h-full flex-col justify-between rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold text-zinc-900 text-sm">Payment Details</h3>
        
        <div className="relative my-4 flex h-40 w-full justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={CHART_DATA}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
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

        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500"></div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-900">Program Earnings</span>
                <span className="text-[11px] text-zinc-500">Received by YBB</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-zinc-900">{formatIDR(data.programEarnings)}</span>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-purple-500"></div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-900">Admin Fee</span>
                <span className="text-[11px] text-zinc-500">Midtrans — ±2%</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-zinc-900">{formatIDR(data.adminFee)}</span>
          </div>
        </div>
      </div>
      <div className="mt-6 border-t border-zinc-100 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-zinc-900">Total Payments</span>
            <span className="text-[11px] text-zinc-500">Paid by participants</span>
          </div>
          <span className="text-sm font-bold text-zinc-900">{formatIDR(data.totalPayment)}</span>
        </div>
      </div>
    </section>
  );
}