"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  UserGroupIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { programs } from "../navbar/ProgramSelect";

type TrendRange = "daily" | "weekly" | "monthly";

type ProgramDashboardProps = {
  selectedProgramId: string;
};

export function ProgramDashboard({ selectedProgramId }: ProgramDashboardProps) {
  const [trendRange, setTrendRange] = useState<TrendRange>("daily");
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showNationalityModal, setShowNationalityModal] = useState(false);
  const [showAmbassadorModal, setShowAmbassadorModal] = useState(false);

  const program = programs.find((p) => p.id === selectedProgramId) ?? null;

  if (!program) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
        Program tidak ditemukan. Silakan pilih program lain dari menu di atas.
      </div>
    );
  }

  const isJys2026 = program.id === "jys-2026";

  const dailyData = [
    { label: "1 Nov", registrations: 42 },
    { label: "2 Nov", registrations: 58 },
    { label: "3 Nov", registrations: 73 },
    { label: "4 Nov", registrations: 61 },
    { label: "5 Nov", registrations: 95 },
    { label: "6 Nov", registrations: 82 },
    { label: "7 Nov", registrations: 77 },
  ];

  const weeklyData = [
    { label: "1–7 Nov", registrations: 210 },
    { label: "8–14 Nov", registrations: 320 },
    { label: "15–21 Nov", registrations: 280 },
    { label: "22–30 Nov", registrations: 340 },
  ];

  const monthlyData = [
    { label: "Jan", registrations: 420 },
    { label: "Feb", registrations: 510 },
    { label: "Mar", registrations: 610 },
    { label: "Apr", registrations: 580 },
  ];

  const trendDataByRange: Record<TrendRange, { label: string; registrations: number }[]> = {
    daily: dailyData,
    weekly: weeklyData,
    monthly: monthlyData,
  };

  const trendData = trendDataByRange[trendRange];

  const genderData = [
    { name: "Male", value: 320 },
    { name: "Female", value: 360 },
  ];

  const genderColors = ["#2563eb", "#ec4899", "#6b7280"];

  const ageDistribution = [
    { range: "17-20", count: 180 },
    { range: "21-24", count: 260 },
    { range: "25-28", count: 150 },
    { range: "29-32", count: 70 },
  ];

  const nationalityData = [
    { country: "Indonesia", count: 420 },
    { country: "Japan", count: 110 },
    { country: "Malaysia", count: 60 },
    { country: "Thailand", count: 45 },
    { country: "Others", count: 53 },
  ];

  const topAmbassadors = [
    { name: "Alya Putri", country: "Indonesia", referrals: 48 },
    { name: "Kenji Sato", country: "Japan", referrals: 37 },
    { name: "Nurul Huda", country: "Malaysia", referrals: 29 },
    { name: "Thanakorn Chai", country: "Thailand", referrals: 22 },
    { name: "Dimas Aji", country: "Indonesia", referrals: 19 },
    { name: "Siti Aisyah", country: "Indonesia", referrals: 17 },
    { name: "Rizky Maulana", country: "Indonesia", referrals: 15 },
  ];

  return (
    <div className="space-y-4">
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
              <h1 className="text-xl font-semibold text-zinc-900">
                {program.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {isJys2026
                  ? "Dashboard Japan Youth Summit 2026."
                  : "Dashboard program terpilih."}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">Program ID</span>
            <span>{program.id}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-500">
            <UserGroupIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Total Participants
            </div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900">688</div>
            <div className="mt-1 text-xs text-emerald-600">166 today</div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <UsersIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Ambassadors
            </div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900">59</div>
            <div className="mt-1 text-xs text-zinc-500">Active ambassadors</div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 text-purple-500">
            <ArrowTrendingUpIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Referred Participants
            </div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900">0</div>
            <div className="mt-1 text-xs text-zinc-500">0% of total</div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <ClockIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Program Status
            </div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900">Active</div>
            <div className="mt-1 text-xs text-zinc-500">2026-05-11 00:00:00</div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Daily Registration Trend
              </div>
              <p className="text-[11px] text-zinc-500">
                Performa pendaftaran untuk program ini.
              </p>
            </div>
            <div className="flex gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 text-[11px] text-zinc-600">
              {(["daily", "weekly", "monthly"] as TrendRange[]).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTrendRange(range)}
                  className={`rounded-full px-2 py-0.5 capitalize transition ${
                    trendRange === range
                      ? "bg-blue-600 text-white shadow-sm"
                      : "hover:bg-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickCount={5}
                />
                <Tooltip
                  cursor={{ stroke: "#bfdbfe", strokeWidth: 1 }}
                  contentStyle={{ fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="registrations"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Gender Distribution
              </div>
              <p className="text-[11px] text-zinc-500">
                Komposisi peserta berdasarkan gender.
              </p>
            </div>
            <button
              type="button"
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
              onClick={() => setShowGenderModal(true)}
            >
              View all
            </button>
          </div>

          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={(props) => {
                    const total = genderData.reduce((sum, g) => sum + g.value, 0);
                    const percent = total
                      ? ((props.value as number) / total) * 100
                      : 0;

                    if (percent < 5) return null;

                    return `${percent.toFixed(1)}%`;
                  }}
                >
                  {genderData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={genderColors[index % genderColors.length]}
                    />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span className="text-[11px] text-zinc-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Age Distribution
              </div>
              <p className="text-[11px] text-zinc-500">
                Sebaran usia peserta program.
              </p>
            </div>
            <button
              type="button"
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
              onClick={() => setShowAgeModal(true)}
            >
              View all
            </button>
          </div>

          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageDistribution} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="range"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickCount={5}
                />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Top Nationalities
              </div>
              <p className="text-[11px] text-zinc-500">
                Negara dengan jumlah peserta terbanyak.
              </p>
            </div>
            <button
              type="button"
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
              onClick={() => setShowNationalityModal(true)}
            >
              View all
            </button>
          </div>

          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={nationalityData}
                layout="vertical"
                margin={{ left: 40, right: 10, top: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="country"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={80}
                />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Top Ambassadors
            </div>
            <p className="text-[11px] text-zinc-500">
              Ambassador dengan jumlah referal terbanyak.
            </p>
          </div>
          <button
            type="button"
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
            onClick={() => setShowAmbassadorModal(true)}
          >
            View all
          </button>
        </div>

        <div className="mt-2 overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full border-collapse text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Nationality</th>
                <th className="px-3 py-2 text-right font-semibold">Referrals</th>
              </tr>
            </thead>
            <tbody>
              {topAmbassadors.slice(0, 5).map((amb, index) => (
                <tr
                  key={amb.name}
                  className={index % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}
                >
                  <td className="px-3 py-1.5 text-zinc-800">{amb.name}</td>
                  <td className="px-3 py-1.5 text-zinc-700">{amb.country}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-700">
                    {amb.referrals}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showGenderModal && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowGenderModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Gender Distribution Details
                </h2>
                <p className="text-[11px] text-zinc-500">
                  Ringkasan peserta berdasarkan gender.
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700"
                onClick={() => setShowGenderModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="overflow-hidden rounded-md border border-zinc-200">
              <table className="min-w-full border-collapse text-left text-[11px]">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Gender</th>
                    <th className="px-3 py-2 font-semibold text-right">
                      Number of Participants
                    </th>
                    <th className="px-3 py-2 font-semibold text-right">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {genderData.map((item, index) => {
                    const total = genderData.reduce((sum, g) => sum + g.value, 0);
                    const percentage = total
                      ? ((item.value / total) * 100).toFixed(1)
                      : "0.0";

                    return (
                      <tr
                        key={item.name}
                        className={index % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}
                      >
                        <td className="px-3 py-1.5 text-zinc-800">{item.name}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-700">
                          {item.value}
                        </td>
                        <td className="px-3 py-1.5 text-right text-zinc-600">
                          {percentage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAmbassadorModal && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowAmbassadorModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Top Ambassadors Details
                </h2>
                <p className="text-[11px] text-zinc-500">
                  Daftar lengkap ambassador dan jumlah referalnya.
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700"
                onClick={() => setShowAmbassadorModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="overflow-hidden rounded-md border border-zinc-200">
              <table className="min-w-full border-collapse text-left text-[11px]">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Nationality</th>
                    <th className="px-3 py-2 text-right font-semibold">Referrals</th>
                  </tr>
                </thead>
                <tbody>
                  {topAmbassadors.map((amb, index) => (
                    <tr
                      key={amb.name}
                      className={index % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}
                    >
                      <td className="px-3 py-1.5 text-zinc-800">{amb.name}</td>
                      <td className="px-3 py-1.5 text-zinc-700">{amb.country}</td>
                      <td className="px-3 py-1.5 text-right text-zinc-700">
                        {amb.referrals}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAgeModal && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowAgeModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Age Distribution Details</h2>
                <p className="text-[11px] text-zinc-500">
                  Ringkasan peserta berdasarkan rentang usia.
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700"
                onClick={() => setShowAgeModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="overflow-hidden rounded-md border border-zinc-200">
              <table className="min-w-full border-collapse text-left text-[11px]">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Age Range</th>
                    <th className="px-3 py-2 font-semibold text-right">Number of Participants</th>
                    <th className="px-3 py-2 font-semibold text-right">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {ageDistribution.map((item, index) => {
                    const total = ageDistribution.reduce((sum, a) => sum + a.count, 0);
                    const percentage = total
                      ? ((item.count / total) * 100).toFixed(1)
                      : "0.0";

                    return (
                      <tr
                        key={item.range}
                        className={index % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}
                      >
                        <td className="px-3 py-1.5 text-zinc-800">{item.range}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-700">{item.count}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-600">{percentage}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showNationalityModal && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowNationalityModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Top Nationalities Details</h2>
                <p className="text-[11px] text-zinc-500">
                  Ringkasan peserta berdasarkan negara.
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700"
                onClick={() => setShowNationalityModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="overflow-hidden rounded-md border border-zinc-200">
              <table className="min-w-full border-collapse text-left text-[11px]">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nationality</th>
                    <th className="px-3 py-2 font-semibold text-right">Count</th>
                    <th className="px-3 py-2 font-semibold text-right">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {nationalityData.map((item, index) => {
                    const total = nationalityData.reduce((sum, n) => sum + n.count, 0);
                    const percentage = total
                      ? ((item.count / total) * 100).toFixed(1)
                      : "0.0";

                    return (
                      <tr
                        key={item.country}
                        className={index % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}
                      >
                        <td className="px-3 py-1.5 text-zinc-800">{item.country}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-700">{item.count}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-600">{percentage}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
