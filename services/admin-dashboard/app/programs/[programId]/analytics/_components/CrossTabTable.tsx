"use client";
// app/programs/[programId]/analytics/_components/CrossTabTable.tsx

import { useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/src/ui/dropdown-menu";
import {
  Download,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Clipboard,
  FileSpreadsheet,
  FileText,
  Printer,
} from "lucide-react";
import type { CrossTabResult } from "@/src/shared/api-client";

interface CrossTabTableProps {
  data: CrossTabResult;
  title?: string;
}

type SortKey = "__key" | "__total" | string;

function SortIcon({ k, sortKey, sortDir }: { k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  if (sortKey !== k) return <ChevronsUpDown className="h-3 w-3 text-zinc-400" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3 w-3 text-blue-500" />
    : <ChevronDown className="h-3 w-3 text-blue-500" />;
}

export function CrossTabTable({ data, title }: CrossTabTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("__total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [exporting, setExporting] = useState(false);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = q
      ? data.rows.filter((row) => row.key.toLowerCase().includes(q))
      : [...data.rows];

    rows.sort((a, b) => {
      if (sortKey === "__key") {
        const cmp = a.key.localeCompare(b.key);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const aVal = sortKey === "__total" ? a.total : (a.cells[sortKey] ?? 0);
      const bVal = sortKey === "__total" ? b.total : (b.cells[sortKey] ?? 0);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return rows;
  }, [data.rows, search, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  // Build 2D array (header + data rows + totals row) for export
  function buildMatrix(): string[][] {
    const header = ["", ...data.columns, "Total"];
    const rows = filteredRows.map((row) => [
      row.key,
      ...data.columns.map((col) => String(row.cells[col] ?? 0)),
      String(row.total),
    ]);
    const totals = [
      "Total",
      ...data.columns.map((col) => String(data.columnTotals[col] ?? 0)),
      String(data.grandTotal),
    ];
    return [header, ...rows, totals];
  }

  function handleCopyTSV() {
    const tsv = buildMatrix()
      .map((row) => row.join("\t"))
      .join("\n");
    void navigator.clipboard.writeText(tsv);
  }

  function handleDownloadCSV() {
    const csv = buildMatrix()
      .map((row) =>
        row
          .map((cell) =>
            cell.includes(",") || cell.includes('"') || cell.includes("\n")
              ? `"${cell.replace(/"/g, '""')}"`
              : cell,
          )
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title ?? "crosstab"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet(buildMatrix());
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${title ?? "crosstab"}.xlsx`);
    } catch {
      // silently fail — export is non-critical
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadPDF() {
    setExporting(true);
    try {
      const [{ jsPDF }, { autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const matrix = buildMatrix();
      const doc = new jsPDF({ orientation: "landscape" });
      if (title) {
        doc.setFontSize(12);
        doc.text(title, 14, 14);
      }
      autoTable(doc, {
        head: [matrix[0]],
        body: matrix.slice(1, -1),
        foot: [matrix[matrix.length - 1]],
        startY: title ? 20 : 14,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
        footStyles: { fillColor: [244, 244, 245], fontStyle: "bold" },
      });
      doc.save(`${title ?? "crosstab"}.pdf`);
    } catch {
      // silently fail
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    const matrix = buildMatrix();
    const thead = `<tr>${matrix[0].map((h) => `<th style="background:#3b82f6;color:white;padding:4px 8px;border:1px solid #ccc">${h}</th>`).join("")}</tr>`;
    const tbody = matrix
      .slice(1, -1)
      .map((row) => `<tr>${row.map((c) => `<td style="padding:4px 8px;border:1px solid #ccc">${c}</td>`).join("")}</tr>`)
      .join("");
    const tfoot = `<tr>${matrix[matrix.length - 1].map((c) => `<th style="background:#f4f4f5;padding:4px 8px;border:1px solid #ccc">${c}</th>`).join("")}</tr>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>${title ?? "Cross-tab"}</title><style>body{font-family:sans-serif;font-size:12px}table{border-collapse:collapse}</style></head><body>${title ? `<h3 style="margin-bottom:12px">${title}</h3>` : ""}<table><thead>${thead}</thead><tbody>${tbody}</tbody><tfoot>${tfoot}</tfoot></table></body></html>`,
    );
    w.document.close();
    w.print();
    w.close();
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3">
        {title && (
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
        )}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter rows…"
            className="h-8 w-44 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={exporting}
                className="flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? "Exporting…" : "Export"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onSelect={handleCopyTSV}>
                <Clipboard className="mr-2 h-3.5 w-3.5" />
                Copy as TSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDownloadCSV}>
                <FileText className="mr-2 h-3.5 w-3.5" />
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { void handleDownloadExcel(); }}>
                <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                Download Excel
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { void handleDownloadPDF(); }}>
                <FileText className="mr-2 h-3.5 w-3.5" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handlePrint}>
                <Printer className="mr-2 h-3.5 w-3.5" />
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50">
            <tr>
              <th
                className="sticky left-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2.5 text-left font-medium text-zinc-500"
                onClick={() => toggleSort("__key")}
              >
                <span className="flex items-center gap-1">
                  Row
                  <SortIcon k="__key" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              {data.columns.map((col) => (
                <th
                  key={col}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-right font-medium text-zinc-500"
                  onClick={() => toggleSort(col)}
                >
                  <span className="flex items-center justify-end gap-1">
                    {col}
                    <SortIcon k={col} sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </th>
              ))}
              <th
                className="cursor-pointer select-none whitespace-nowrap bg-zinc-100 px-3 py-2.5 text-right font-semibold text-zinc-700"
                onClick={() => toggleSort("__total")}
              >
                <span className="flex items-center justify-end gap-1">
                  Total
                  <SortIcon k="__total" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={data.columns.length + 2}
                  className="py-8 text-center text-xs text-zinc-400"
                >
                  No rows match your filter.
                </td>
              </tr>
            )}
            {filteredRows.map((row) => (
              <tr key={row.key} className="hover:bg-zinc-50/50">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-zinc-700">
                  {row.key}
                </td>
                {data.columns.map((col) => (
                  <td key={col} className="px-3 py-2 text-right text-zinc-600">
                    {(row.cells[col] ?? 0).toLocaleString()}
                  </td>
                ))}
                <td className="bg-zinc-50 px-3 py-2 text-right font-semibold text-zinc-700">
                  {row.total.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-zinc-200 bg-zinc-100">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-zinc-100 px-3 py-2.5 font-semibold text-zinc-700">
                Total
              </td>
              {data.columns.map((col) => (
                <td key={col} className="px-3 py-2.5 text-right font-semibold text-zinc-700">
                  {(data.columnTotals[col] ?? 0).toLocaleString()}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-bold text-zinc-900">
                {data.grandTotal.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
