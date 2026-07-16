// services/admin-dashboard/app/components/participants/InfoField.tsx
import React from "react";

interface InfoFieldProps {
  label: string;
  value: React.ReactNode;
  isLink?: boolean;
}

export function InfoField({ label, value, isLink = false }: InfoFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      {isLink && typeof value === 'string' ? (
        <a 
          href={value} 
          target="_blank" 
          rel="noreferrer" 
          className="text-sm font-semibold text-blue-600 hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm font-semibold text-zinc-900">{value || "-"}</span>
      )}
    </div>
  );
}